#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一条命令跑完整包：组 prompt → 出图 → 切割 → 后处理 → 分发 → 再出背板。

用法（推荐，直接喂规划，静态素材出完再出背板）:
  python3 run_pipeline.py --plan-file asset-plan.json --out sheet --dest .
用法（只出 sheet，老接口仍然可用）:
  python3 run_pipeline.py <items.json> --out <dir> [--max-side 128]

可选: [--variants verbatim,generic,generic2] [--size 2848x1152] [--pad 16]
      [--bg-size 1536x1024] [--max-per-sheet N] [--no-split]
      [--no-bg] [--no-seam] [--no-distribute] [--dry-run]

传 --plan-file 时脚本自己把四件事做完，调用方不用再分步调:
  1. plan_to_items.py 把规划翻成 sheet 清单（role=background 被剔掉）
  2. build_sheet_prompt.py → generate_sheet.py 出 sheet（被拦就升级变体）→
     slice_sheet.py 切片 → postprocess_items.py 后处理 → distribute_items.py 分发
  3. **静态素材那条链路全部走完之后**，再用规划里 role=background 那条的 prompt
     单独请求一次背板，再用 fit_background.py 裁到它的 canvas_width x canvas_height，
     然后**按需**用 seam_background.py 把背板改成可水平循环平铺的版本（左右对半互换拼接 →
     image-edits 美化中间接缝，被拦截/异常就回退用未拼接的原背板）。seam 只对会横向
     循环平铺的横版背景才跑（view==side 且 usage/description 含 滚动/平移/拼接），其余
     背景跳过（res.seam_skipped 记原因），省一次 image-edits 调用。
     每次请求都走 image-generation-super，串行发出，先静态素材后背板
  4. --max-side 没传时按 art_style 取（pixel 128 / hd 256），背板 --style 同理

**素材太多会自动拆成多张 sheet**：单张 sheet 固定最多 6 个素材，不看 art_style、不看
分辨率预算 —— 这是调用次数的产品决策，不是像素算出来的。超过 6 个就摊成 N 张、每张各
一次请求，姿态变体跟它的 base 留在同一张（跨图互指会失效，同一个角色会被画成两个）。
`--no-split` 可以换回「省请求、认了分辨率」，`--max-per-sheet` 手工改这个 6。

背板是独立的一次请求：sheet 全被拦时它照样会出（一张背板 > 零个产物），
反过来背板失败也不影响已经分发好的静态素材。背板出完之后**若判定需要水平循环**
（view==side 且 usage 含 滚动/平移/拼接）才紧接着再请求一次 image-edits 美化拼接接缝
（第 5 次子请求），这次被拦截/异常不影响背板本身已经产出——回退用**未拼接的原背板**
（等于这一步没跑过，循环时接缝仍生硬但画面完整可信），`--no-seam` 可以整体跳过这一步。

被内容安全拦截（generate_sheet.py 退出码 3）时自动升级到下一个变体，
只有真正出图的那个变体才继续切割和后处理。--dry-run 只产出 prompt 不请求。

产出:
  <out>/sheet-items.json             --plan-file 模式下由脚本生成
  <out>/prompt_<variant>.txt / prompt_<variant>_plan.json
  <out>/sheet_<variant>.png          出图结果
  <out>/logs/<variant>.json          每次提交的原始返回（含 400 报文）
  <out>/items/NN_<name>.png          切片（带白边，未紧裁）
  <out>/clean/NN_<name>.png          后处理成品（透明底、最小外接矩形）
  <out>/slice_report.json / clean_report.json / pipeline.json
  <out>/sheetK/…                     拆成多张时，上面那几样按张放进 sheet1/ sheet2/…，
                                     成品仍然汇总到 <out>/clean 再统一分发
  <out>/bg_prompt.txt / bg_raw.png / logs/bg.json    背板那条链路
  <out>/bg_seam_raw.png / bg_seam_prompt.txt / logs/bg_seam.json  拼接美缝那条链路
                                     （bg_seam_raw.png 只是拼接中间图，失败时不会被当成
                                      最终背板交付，仅供排查用）
  <dest>/<key>/<key>.png             分发结果（背板也在这里，已是美缝后/回退原图后的版本）

**pipeline.json 是这一步唯一需要读的报告**：sheets / px_budget / used_variant /
backend / slice / clean / bg / distribute / next_action 都汇总在里面，不用再逐个
cat 其它 json、更不用写探针。

退出码: 0 正常（可能带告警，看 next_action）；3 所有 sheet 都被内容安全拦截；1 硬失败。
"""
import argparse, io, json, math, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_sheet_prompt as bsp  # noqa: E402  网格/像素预算的口径只在那边定义一次

SIZES = ('1024x1024', '1536x1024', '1024x1536', '2848x1152')
MAX_SIDE = bsp.MAX_SIDE


def run(argv):
    """跑一个子脚本，原样透出它的 stdout / stderr。返回 (退出码, stdout)。"""
    p = subprocess.run(argv, capture_output=True, text=True)
    out, err = (p.stdout or '').strip(), (p.stderr or '').strip()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return p.returncode, out


def last_json(text):
    for line in reversed((text or '').splitlines()):
        line = line.strip()
        if line.startswith('{'):
            try:
                return json.loads(line)
            except Exception:
                pass
    return {}


def parse_size(s):
    w, h = str(s).lower().partition('x')[::2]
    return int(w), int(h)


def pick_size(target):
    """按目标比例挑一档网关真的支持的出图尺寸。"""
    tw, th = parse_size(target)
    want = tw / float(th)
    return min(SIZES, key=lambda s: abs(parse_size(s)[0] / float(parse_size(s)[1]) - want))


def find_bg(plan):
    """规划里那条整幅背板。分组的 groups[].assets[] 和平铺的 assets[] 都收。"""
    plan = plan or {}
    flat = [it for g in plan.get('groups') or [] for it in g.get('assets') or []]
    for it in flat or (plan.get('assets') or []):
        if it.get('role') == 'background':
            return it
    return None


def gen_argv(a, prompt_file, png, size, log):
    argv = [sys.executable, os.path.join(HERE, 'generate_sheet.py'),
            '--prompt', prompt_file, '--out', png, '--size', size, '--log', log]
    if a.skill_script:
        argv += ['--skill-script', a.skill_script]
    if a.direct:
        argv += ['--direct']
    return argv


def sheet_cap(n, size, style):
    """这个画布上单素材的像素预算诊断信息（仅用于 pipeline.json 里的 px_budget 等字段）。

    真正的拆图上限不再由这里的像素预算算出 —— 见 `bsp.ITEMS_PER_SHEET`：单张 sheet
    固定最多 6 个素材，超过无条件拆图，不看 art_style、不看这里算出来的像素余量。
    这函数保留只是为了把 px_budget/px_target/px_need/px_ok 继续写进报告，方便判断
    「即使没超 6 个，这张图是不是也偏挤」。
    """
    rows, cols = bsp.grid_of(n, size)
    geo = bsp.geometry(size, cols, rows)
    px = bsp.px_check(geo, style)
    return px, px['px_max_items'] or n


def base_groups(items):
    """按 `base` 链把素材分组，组内不可拆开。

    姿态变体靠「与第 N 项完全同一个对象」保住同一个角色，跨图互指会失效 ——
    hero_idle 和 hero_jump 分到两张图上就是两个角色，比分辨率低更糟。
    """
    idx = {it.get('name'): i for i, it in enumerate(items)}
    root = list(range(len(items)))

    def find(i):
        while root[i] != i:
            i = root[i]
        return i

    for i, it in enumerate(items):
        j = idx.get(it.get('base'))
        if j is not None and j != i:
            ri, rj = find(i), find(j)
            if ri != rj:
                root[max(ri, rj)] = min(ri, rj)
    groups = {}
    for i in range(len(items)):
        groups.setdefault(find(i), []).append(i)
    return [groups[k] for k in sorted(groups)]


def split_items(spec, cap):
    """把清单摊成每张不超过 cap 个素材的几份，份数取最少、各份尽量等大。

    等大是为了分辨率齐平：4+4 两张比 7+1 好，后者那张 7 个的还是偏软。
    """
    items = spec['items']
    parts_n = int(math.ceil(len(items) / float(cap)))
    target = int(math.ceil(len(items) / float(parts_n)))
    parts, cur = [], []
    for g in base_groups(items):
        if cur and len(cur) + len(g) > max(target, len(g)):
            parts.append(cur)
            cur = []
        cur += g
    if cur:
        parts.append(cur)
    return [dict(spec, items=[items[i] for i in sorted(p)]) for p in parts]


def sheet_chain(a, items_file, out, max_side, tag=None):
    """一张 sheet 的完整链路：组 prompt → 出图（被拦就升级变体）→ 切片 → 后处理。

    返回 dict，字段与单图时代的 pipeline.json 同名，多张时装进 parts[]。
    """
    r = {'items': items_file, 'out': out, 'steps': [], 'used_variant': None}
    if tag:
        r['tag'] = tag
    os.makedirs(out, exist_ok=True)
    used = None
    for v in [x.strip() for x in a.variants.split(',') if x.strip()]:
        pf = os.path.join(out, 'prompt_%s.txt' % v)
        if run([sys.executable, os.path.join(HERE, 'build_sheet_prompt.py'), items_file,
                '--out', pf, '--variant', v, '--size', a.size])[0]:
            print('组 prompt 失败（%s）' % v, file=sys.stderr)
            sys.exit(1)
        if a.dry_run:
            r['steps'].append({'variant': v, 'prompt': pf, 'generated': False})
            continue
        png = os.path.join(out, 'sheet_%s.png' % v)
        rc = run(gen_argv(a, pf, png, a.size,
                          os.path.join(out, 'logs', '%s.json' % v)))[0]
        r['steps'].append({'variant': v, 'prompt': pf, 'generated': rc == 0,
                           'blocked': rc == 3, 'exit': rc})
        if rc == 0:
            used = (v, png)
            break
        if rc == 3:
            print('变体 %s 被内容安全拦截，升级到下一个变体' % v, file=sys.stderr)
            continue
        break     # 其它错误：不再往下试变体，但背板那次请求照样要发
    if not used:
        return r
    v, png = used
    r['used_variant'] = v
    # 把出图后端提到顶层：调用方只读 pipeline.json 就知道有没有走官方 skill
    try:
        with io.open(os.path.join(out, 'logs', '%s.json' % v), encoding='utf-8') as f:
            r['backend'] = json.load(f).get('backend')
    except Exception:
        r['backend'] = None
    items_dir = os.path.join(out, 'items')
    rc, txt = run([sys.executable, os.path.join(HERE, 'slice_sheet.py'), png,
                   '--out', items_dir, '--pad', str(a.pad),
                   '--plan', os.path.join(out, 'prompt_%s_plan.json' % v),
                   '--report', os.path.join(out, 'slice_report.json')])
    # rc=2 是「切出数和期望不符」：切片本身可用，继续后处理，不在这里断
    r['slice_ok'], r['slice'] = rc == 0, last_json(txt)
    clean_dir = os.path.join(out, 'clean')
    rc, txt = run([sys.executable, os.path.join(HERE, 'postprocess_items.py'),
                   items_dir, '--out', clean_dir, '--max-side', str(max_side),
                   '--report', os.path.join(out, 'clean_report.json')])
    r['clean_ok'], r['clean'] = rc == 0, last_json(txt)
    r['clean_dir'] = clean_dir
    return r


def merge_clean(parts, dest):
    """把各份的 clean 汇到一个目录，重新连号（各份都从 01 起，直接拷会撞名）。"""
    import shutil
    os.makedirs(dest, exist_ok=True)
    n = 0
    for p in parts:
        d = p.get('clean_dir')
        if not d or not os.path.isdir(d):
            continue
        for f in sorted(x for x in os.listdir(d) if x.lower().endswith('.png')):
            n += 1
            stem = os.path.splitext(f)[0]
            head, _, rest = stem.partition('_')
            name = rest if rest and head.isdigit() else stem
            shutil.copy2(os.path.join(d, f),
                         os.path.join(dest, '%02d_%s.png' % (n, name)))
    return dest, n


def merge_reports(parts):
    """把各份的 slice / clean 报告合成一份汇总，字段和单图时一致好让 next_action 复用。"""
    sl = {'match': True, 'names_reliable': True, 'geom_ok': True, 'sliced': 0, 'expect': 0}
    cl = {'ok': 0, 'failed': 0, 'bg_keyed': 0}
    for p in parts:
        s, c = p.get('slice') or {}, p.get('clean') or {}
        if s.get('match') is False:
            sl['match'] = False
        if s.get('names_reliable') is False:
            sl['names_reliable'] = False
        if s.get('geom_ok') is False:
            sl['geom_ok'] = False
        sl['sliced'] += s.get('sliced') or len(s.get('items') or [])
        sl['expect'] += s.get('expect') or 0
        for k in cl:
            cl[k] += c.get(k) or 0
    return sl, cl


def background_job(a, bg, out, dest, style):
    """静态素材走完之后单独出一次背板 → 裁到规划里的画布尺寸。

    这条线里任何异常都只记在返回的 dict 里：背板挂了不能连坐 sheet 的产物。
    """
    res = {}
    try:
        _background_job(a, bg, out, dest, style, res)
    except Exception as e:                       # noqa: BLE001 —— 兜住整条背板链路
        res['error'] = '%s: %s' % (type(e).__name__, e)
    return res


# seam（水平循环美缝）只对「会横向循环平铺」的背景有意义：横版游戏把同一张背板
# 首尾相接无限滚动时，右缘接左缘那条缝才需要抹平。top_down/front/isometric/flat 或
# 静止不滚动的背板过 seam 是白烧一次 image-edits 调用（还可能被 editImage 改坏），
# 所以按需触发：view==side 且 usage/description 里明确提到横向滚动/平移/首尾拼接才过。
# tileable 字段在本流水线恒为 false（Gate 2/5 设计如此），不能拿来当判据，只能看语义文本。
_SEAM_KEYWORDS = ('滚动', '平移', '拼接', 'scroll', 'pan', 'wrap', 'loop')


def _needs_seam(bg):
    if (bg.get('view') or '').strip().lower() != 'side':
        return False
    text = (bg.get('usage') or '') + '\n' + (bg.get('description') or '')
    return any(k in text for k in _SEAM_KEYWORDS)


def _background_job(a, bg, out, dest, style, res):
    key = bg.get('key') or 'bg_main'
    target = '%sx%s' % (bg.get('canvas_width') or 1280, bg.get('canvas_height') or 720)
    pf = os.path.join(out, 'bg_prompt.txt')
    with io.open(pf, 'w', encoding='utf-8') as f:
        f.write((bg.get('prompt') or bg.get('description') or '').strip())
    res.update({'key': key, 'target': target, 'ok': False})
    raw = os.path.join(out, 'bg_raw.png')
    size = a.bg_size or pick_size(target)
    rc, _ = run(gen_argv(a, pf, raw, size, os.path.join(out, 'logs', 'bg.json')))
    res['gen_exit'], res['gen_size'] = rc, size
    if rc:
        res['blocked'] = rc == 3
        return
    dst = os.path.join(dest, key, '%s.png' % key)
    rc, txt = run([sys.executable, os.path.join(HERE, 'fit_background.py'), raw,
                   '--out', dst, '--target', target, '--style', style,
                   '--prompt-file', pf])
    d = last_json(txt)
    res.update({'ok': rc == 0, 'file': dst, 'out_size': d.get('out_size'),
                'flattened': d.get('flattened'),
                'blankBottomY': d.get('blankBottomY'),
                'blankBottomHeight': d.get('blankBottomHeight'),
                'blankBottomYRatio': d.get('blankBottomYRatio'),
                'blankBottomRefHeight': d.get('blankBottomRefHeight'),
                'blankBottomSource': d.get('blankBottomSource')})
    if not res['ok'] or a.no_seam:
        return
    if not _needs_seam(bg):
        # 不是会横向循环平铺的横版背景，跳过 seam（保留 fit 后的原背板）
        res['seam_skipped'] = 'not_horizontal_loop'
        return
    # 裁剪缩放完的最终背板 → 左右对半互换拼接 → image-edits 美化中间接缝，
    # 让背板可以在横版游戏里水平循环平铺而不出现明显割裂感。就地替换 dst，
    # 失败（被拦截/异常）时 seam_background.py 自己回退成「未拼接的原背板」，
    # 等于这一步没跑过，不影响这条链路已经产出的 ok=True 结果。
    seam_argv = [sys.executable, os.path.join(HERE, 'seam_background.py'), dst,
                 '--out', dst, '--raw-out', os.path.join(out, 'bg_seam_raw.png'),
                 '--log', os.path.join(out, 'logs', 'bg_seam.json'),
                 '--style', style]
    if a.skill_script:
        seam_argv += ['--skill-script', a.skill_script]
    if a.direct:
        seam_argv += ['--direct']
    rc, txt = run(seam_argv)
    sd = last_json(txt)
    res.update({'seam_ok': sd.get('seam_ok'), 'seam_blocked': sd.get('seam_blocked')})


def next_action(r):
    """把「下一步该干什么」写死在报告里，省掉调用方自己推。"""
    if not r.get('used_variant'):
        return ('all_variants_blocked: 三档变体全被内容安全拦截。改规划——把成套的作品'
                '特征拆掉（换配色、换造型、换命名，theme 和每条 prompt 都改），再跑一次')
    parts = r.get('parts') or []
    dead = [p.get('tag') for p in parts if not p.get('used_variant')]
    if dead:
        return ('partial_sheets_blocked: 拆成 %d 张，其中 %s 被拦或出图失败，那几张上的'
                '素材一个都没有。别整包重跑，只把那几张的清单（<out>/%s/sheet-items.json）'
                '改词后单独重出' % (len(parts), ','.join(dead), dead[0]))
    sl = r.get('slice') or {}
    if sl.get('match') is False:
        return ('slice_mismatch: 两条切割算法都凑不出规划的素材数（见 slice_report.json '
                '的 tried）。素材在图上真的粘成一块了，用 --dilate 10 --pad 24 重切一次；'
                '还不行就把对不上的 key 记 missing 继续走')
    if sl.get('geom_ok') is False:
        return ('geom_violation: 切块数量凑够了，但几何安全闸发现有切块跨格/退化成细条/'
                '互相交叠（见 slice_report.json 的 geom_bad），这些已标 unmatched 未发布。'
                '八成是生图画对了但切割定区错位（连通域误判、agglomerate 错并）；'
                '用 --dilate 10 --pad 24 重切，或把这几个 key 记 missing 继续走')
    if sl.get('names_reliable') is False:
        return ('names_unreliable: 有行的块数和规划不符，那一行已改名 unmatched_NN 且'
                '没有发布（见 slice_report.json 的 row_counts）。别手工猜名字对应关系，'
                '把这几个 key 记 missing 继续走')
    cl = r.get('clean') or {}
    if cl.get('failed'):
        return 'clean_failed: 看 clean_report.json 里 error 那几条，记 missing 继续走'
    if cl.get('ok') and cl.get('bg_keyed', 0) < cl.get('ok', 0):
        return ('not_keyed: 有素材没做 chroma 去底（bg_kind != chroma），多半是切片垫的 '
                'key 色边框不够。用 --pad 24 重切再重跑后处理；只影响那几条，别整包重出')
    di = r.get('distribute') or {}
    if di.get('missing') or di.get('extra'):
        return 'key_mismatch: 切片和规划的 key 对不上，见 distribute.missing/extra'
    bg = r.get('bg')
    if bg is not None and not bg.get('ok'):
        return ('bg_failed: 背板没出来（blocked=%s error=%s）。单独重跑一次背板即可，'
                'sheet 的产物不受影响' % (bg.get('blocked'), bg.get('error')))
    if bg is not None and bg.get('ok') and bg.get('seam_ok') is False:
        return ('seam_blocked: 背板拼接美缝被拦截或失败（blocked=%s），已回退用未拼接的'
                '原背板交付（水平循环时接缝仍会有割裂感，但背板本身可用）。'
                '可单独重跑 seam_background.py 再试一次，不影响其它产物' % bg.get('seam_blocked'))
    if r.get('px_ok') is False:
        return ('low_res: 素材已就位，但 %d 个素材挤在一张图上，每个只有 %d px（目标 %d），'
                '成品偏软。去掉 --no-split 重跑可以拆图换分辨率' %
                (r.get('item_count') or 0, r.get('px_budget') or 0,
                 r.get('px_target') or 0))
    return 'ok: 素材已就位，去量图写 manifest'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('items', nargs='?', help='sheet 清单；给了 --plan-file 就不用给它')
    ap.add_argument('--plan-file', help='asset-plan.json：自动出清单、素材出完再出背板、自动分发')
    ap.add_argument('--out', required=True)
    ap.add_argument('--dest', help='分发目标目录（默认 --out 的上一级），产出 <key>/<key>.png')
    ap.add_argument('--variants', default='verbatim,generic,generic2')
    ap.add_argument('--size', default='2848x1152')
    ap.add_argument('--max-side', type=int, help='不传则按 art_style 取 128 / 256')
    ap.add_argument('--pad', type=int, default=16)
    ap.add_argument('--max-per-sheet', type=int, default=bsp.ITEMS_PER_SHEET,
                    help='单张 sheet 最多几个素材，默认 6，超过无条件拆图')
    ap.add_argument('--no-split', action='store_true',
                    help='素材再多也只出一张（省一次请求，代价是素材分辨率下降）')
    ap.add_argument('--bg-size', help='背板出图档位，默认按它的画布比例自动挑')
    ap.add_argument('--skill-script',
                    help='image-generation-super 的 generate_image.py；'
                         '不传则按 IMAGE_GEN_SUPER_SCRIPT / 约定位置解析')
    ap.add_argument('--direct', action='store_true',
                    help='跳过 image-generation-super，用内置直连（仅调试用）')
    ap.add_argument('--no-bg', action='store_true', help='不出背板')
    ap.add_argument('--no-seam', action='store_true',
                    help='背板不做左右拼接美缝（跳过 seam_background.py 这一步）')
    ap.add_argument('--no-distribute', action='store_true', help='不分发到 <dest>')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    dest = os.path.abspath(a.dest) if a.dest else os.path.dirname(out)

    plan, items, style = None, a.items, 'pixel'
    if a.plan_file:
        with io.open(a.plan_file, encoding='utf-8') as f:
            plan = json.load(f)
        style = plan.get('art_style') or 'pixel'
        items = os.path.join(out, 'sheet-items.json')
        if run([sys.executable, os.path.join(HERE, 'plan_to_items.py'), a.plan_file,
                '--out', items, '--size', a.size])[0]:
            print('规划翻成 sheet 清单失败：先修 asset-plan.json', file=sys.stderr)
            sys.exit(1)
    elif not items:
        ap.error('要么给 <items.json>，要么给 --plan-file')
    max_side = a.max_side or MAX_SIDE.get(style, 128)

    bg = find_bg(plan)
    with io.open(items, encoding='utf-8') as f:
        spec = json.load(f)
    n = len(spec.get('items') or [])
    px, _ = sheet_cap(n, a.size, spec.get('style') or style)
    # 拆图上限固定 6，不看 art_style、不看这份 px 预算 —— px 只留着记诊断信息。
    cap = a.max_per_sheet
    specs = [spec]
    if n > cap and not a.no_split:
        specs = split_items(spec, cap)
        print('%d 个素材超过单张上限 %d，拆成 %d 张 sheet（每张 %s 个），出图请求 %d 次'
              % (n, cap, len(specs), '+'.join(str(len(s['items'])) for s in specs),
                 len(specs)), file=sys.stderr)
    elif n > cap:
        print('%d 个素材超过单张上限 %d（--no-split 已关闭拆图），出来的素材会偏软'
              % (n, cap), file=sys.stderr)

    parts = []
    for i, s in enumerate(specs, 1):
        if len(specs) == 1:
            f_items, sub = items, out            # 单图：产物路径和以前一模一样
        else:
            sub = os.path.join(out, 'sheet%d' % i)
            os.makedirs(sub, exist_ok=True)
            f_items = os.path.join(sub, 'sheet-items.json')
            with io.open(f_items, 'w', encoding='utf-8') as f:
                f.write(json.dumps(s, ensure_ascii=False, indent=2))
        parts.append(sheet_chain(a, f_items, sub, max_side,
                                 tag=None if len(specs) == 1 else 'sheet%d' % i))

    result = {'items': items, 'plan': a.plan_file, 'out': out, 'dest': dest,
              'size': a.size, 'art_style': style, 'max_side': max_side,
              'item_count': n, 'sheets': len(specs), 'px_budget': px['px_budget'],
              'px_target': px['px_target'], 'px_ok': px['px_ok'] or len(specs) > 1,
              'px_max_items': cap}
    done = [p for p in parts if p.get('used_variant')]
    if len(specs) == 1:
        result.update({k: v for k, v in parts[0].items()
                       if k in ('steps', 'used_variant', 'backend', 'slice_ok',
                                'slice', 'clean_ok', 'clean')})
        clean_dir = parts[0].get('clean_dir')
    else:
        result['parts'] = [{k: v for k, v in p.items() if k != 'clean_dir'}
                           for p in parts]
        result['used_variant'] = ','.join(p['used_variant'] for p in done) or None
        result['backend'] = (done[0].get('backend') if done else None)
        if done:
            result['slice'], result['clean'] = merge_reports(done)
        clean_dir = merge_clean(done, os.path.join(out, 'clean'))[0] if done else None
    if not done and not a.dry_run:
        print('所有变体都被拦截：按 references/moderation.md 改写整套素材词汇后重跑',
              file=sys.stderr)
    if done and plan and not a.no_distribute and clean_dir:
        rc, txt = run([sys.executable, os.path.join(HERE, 'distribute_items.py'),
                       clean_dir, '--dest', dest, '--plan', a.plan_file])
        d = last_json(txt)
        result['distribute'] = {'exit': rc, 'copied': d.get('copied') or [],
                                'skipped': d.get('skipped') or [],
                                'missing': d.get('missing') or [],
                                'extra': d.get('extra') or []}

    # 静态素材那条链路走完了，现在才发最后一次请求出背板（串行，先素材后背板）
    if bg and not a.no_bg and not a.dry_run:
        print('静态素材已就位，开始出背板 %s' % (bg.get('key') or 'bg_main'))
        result['bg'] = background_job(a, bg, out, dest, style)
    result['next_action'] = 'dry_run' if a.dry_run else next_action(result)

    with io.open(os.path.join(out, 'pipeline.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(result, ensure_ascii=False, indent=2))
    brief = {k: result.get(k) for k in
             ('sheets', 'px_budget', 'px_target', 'used_variant', 'backend', 'slice',
              'clean', 'distribute', 'bg', 'next_action') if result.get(k) is not None}
    if brief.get('distribute'):
        brief['distribute'] = {k: v for k, v in brief['distribute'].items()
                               if k != 'copied'}
    if brief.get('bg'):
        brief['bg'] = {k: brief['bg'].get(k)
                       for k in ('key', 'ok', 'out_size', 'blocked',
                                 'blankBottomY', 'blankBottomHeight',
                                 'blankBottomYRatio', 'blankBottomRefHeight',
                                 'blankBottomSource', 'seam_ok', 'seam_blocked',
                                 'seam_skipped')}
    print(json.dumps(brief, ensure_ascii=False))
    if not a.dry_run and not done:
        sys.exit(3)


if __name__ == '__main__':
    main()

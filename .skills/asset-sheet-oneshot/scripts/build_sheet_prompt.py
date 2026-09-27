#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把素材清单组成「一张图出全部素材」的 asset sheet prompt。

用法:
  python3 build_sheet_prompt.py <items.json> --out <prompt.txt> [--variant verbatim|generic|generic2]
                                [--subs extra_subs.json] [--size 2848x1152]

items.json 结构见 assets/items.example.json：
  {"name": "...", "theme": "...", "style": "pixel|hd", "size": "2848x1152",
   "items": [{"name": "hero_idle", "desc": "轨迹原文描述", "base": "另一个素材名（可选）"}]}

`base` 用于姿态/状态变体：轨迹里这类素材是图生图（「只改姿态，其余不变」），
sheet 里没有参考图，所以改写成「与第 N 项完全同一个对象」，靠图内互指代替参考图。

三个变体的由来见 references/moderation.md：
  verbatim  素材描述一字不改，只加英文网格/风格外壳
  generic   换掉受保护角色的标志性配色（消融实验证明删 IP 名不够）
  generic2  再换掉整套素材的词汇，并去掉素材名（`goomba_idle` 这种名字本身就是线索）
"""
import argparse, io, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = {
    'pixel': ('Crisp hard-edged pixels, limited palette, 8-bit/16-bit console aesthetic, '
              'no anti-aliasing, no gradients.'),
    'hd': ('Clean 2D game art, cel shading with smooth gradients, crisp readable silhouettes, '
           'no photographic texture.'),
}

# chroma-key 底色。素材不再画在白底上，而是画在一块纯平 key 色底上，clean_asset 按
# 「离 key 色多远」抠像。key 色取美术里几乎不出现的高饱和色，才不会和素材内容撞
# （旧的白底会和白高光/白描边/雪/云撞，逼着 prompt 禁止素材用白，现在不必了）。
KEY_MAGENTA = '#FF00FF'   # 默认洋红
KEY_GREEN = '#00FF00'     # 素材以洋红/粉/紫为主色时改用，避开撞色
# 触发绿底的关键词：整批素材描述/题材里粉紫调偏多时，洋红会和素材撞，换绿底更稳
_MAGENTAISH = ('粉', '紫', '洋红', '品红', '玫红', '桃红', '紫罗兰',
               'pink', 'magenta', 'purple', 'violet', 'fuchsia', 'lavender')


def _hex_to_rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def pick_key_color(spec):
    """选这张 sheet 的 chroma-key 底色。默认洋红；素材以粉紫为主色时换绿底。

    优先级：items.json 显式 `key_color` > 粉紫关键词命中 → 绿底 > 洋红默认。
    整张共用一个底色（一张图多个素材没法逐个换色），所以按整批词频判断。
    """
    explicit = (spec.get('key_color') or '').strip()
    if explicit:
        return explicit if explicit.startswith('#') else '#' + explicit
    blob = (spec.get('theme') or '')
    for it in spec.get('items') or []:
        blob += ' ' + (it.get('desc') or '') + ' ' + (it.get('name') or '')
    low = blob.lower()
    hits = sum(1 for w in _MAGENTAISH if w in blob or w in low)
    return KEY_GREEN if hits >= 2 else KEY_MAGENTA


def load_subs(variant, extra):
    with io.open(os.path.join(HERE, 'subs.json'), encoding='utf-8') as f:
        d = json.load(f)
    subs = []
    if variant in ('generic', 'generic2'):
        subs += [tuple(x) for x in d['generic']]
    if variant == 'generic2':
        subs += [tuple(x) for x in d['generic2']]
    if extra:
        with io.open(extra, encoding='utf-8') as f:
            subs += [tuple(x) for x in json.load(f)]
    return subs


MAX_SIDE = {'pixel': 128, 'hd': 256}
# 实测角色类素材中位填充率 0.87~0.99（模型基本画满安全框），金币/子弹这类本来就该小
# （prompt 里也明说 pickups and projectiles a little smaller），不该拿它们拖累整体判断。
# 所以余量只留 1.1 倍，不是「模型画不满留大余量」。低于这个数就说明这批分辨率确实吃紧。
PX_HEADROOM = 1.1
# 单张 sheet 的素材上限固定为 6：多于 6 个无条件拆成多张、各出一次生图请求，
# 不按题材、不按像素预算浮动 —— 这是产品侧的调用次数决定，不是分辨率计算的产物。
ITEMS_PER_SHEET = 6


def grid_of(n, size='2848x1152', ratio=0.70, max_rows=3, balance_keep=0.75):
    """挑行数：让单素材统一安全框的**短边**最大 —— 那条短边就是这个素材最终有多少像素。

    行数是分辨率的主开关。画布高固定 1152：1 行给每个素材 806 px 的竖向预算，
    2 行给 403，3 行只给 268，一档一档掉。所以不要按「条数 → 行数」硬分档
    （老口径 ≤4 一行、≤10 两行、其余三行）：11~14 个素材摊成 2 行比 3 行大
    6%~24%，白间隙还更宽，纯白赚。

    但「预算最大」不能是唯一标准：单行多列的**高瘦长条**排布（4 个素材排 4×1、
    格子 712x1152）会被生图模型自作主张重排成 2×2，plan 却按单行去切，上下叠放的
    两个素材被糊成一块（实测 hero_idle 事故：交付图是「站立+跳跃」两个角色叠在一张
    32x128 里）。模型天然倾向把 4 个素材画成 2x2，所以我们**主动请求 2x2**，让请求
    版式和模型的自然产出对齐，切割才切得准。

    做法：先算各行数的预算，取最优预算 best。在预算不低于 best*balance_keep（默认
    0.75，即最多让出 25% 像素换可靠版式）的候选里，优先**更均衡**的网格
    （|cols-rows| 最小），均衡度相同再取预算高、行数少的。实测这条只改变 n=4
    （498px 的 4×1 → 403px 的 2×2），其余素材数的选择与旧逻辑完全一致。
    """
    w, h = [int(x) for x in str(size).lower().split('x')[:2]]

    def cols_of(rows):
        return int(math.ceil(n / float(rows)))

    def budget(rows):
        return min(int((w // cols_of(rows)) * ratio), int((h // rows) * ratio))

    cand = list(range(1, max_rows + 1))
    best = max(budget(r) for r in cand)
    ok = [r for r in cand if budget(r) >= best * balance_keep]
    rows = min(ok, key=lambda r: (abs(cols_of(r) - r), -budget(r), r))
    return rows, cols_of(rows)


def geometry(size, cols, rows, ratio=0.70):
    """把网格算成像素尺寸：每格多大、单个素材的统一安全框多大、最小白间隙多宽。

    尺寸不统一是切割出错的根因：素材各画各的大小，网格就是歪的，列间白缝会被
    高素材/宽素材吃掉，两个素材被切成一块。所以 prompt 里必须给出具体像素数，
    只说「evenly spaced」模型不当回事。
    """
    w, h = [int(x) for x in str(size).lower().split('x')[:2]]
    cw, ch = w // max(1, cols), h // max(1, rows)
    sw, sh = int(cw * ratio), int(ch * ratio)
    return {'canvas': [w, h], 'cell': [cw, ch], 'safe': [sw, sh],
            'gap': min(cw - sw, ch - sh), 'px_budget': min(sw, sh)}


def px_check(geo, style):
    """这张 sheet 每个素材能拿到多少像素，够不够这个风格的交付尺寸。"""
    target = MAX_SIDE.get(style or 'pixel', 128)
    need = int(target * PX_HEADROOM)
    b = geo['px_budget']
    return {'px_budget': b, 'px_target': target, 'px_need': need,
            'px_ok': b >= need,
            'px_max_items': None if b >= need else max_items(need, geo['canvas'])}


def max_items(need, canvas, ratio=0.70, max_rows=3):
    """在这个画布上，单素材还能拿到 need 像素的最大素材数（拆图阈值就是它）。"""
    w, h = canvas
    best = 0
    for rows in range(1, max_rows + 1):
        if int((h // rows) * ratio) < need:
            break
        cols = 1
        while int((w // (cols + 1)) * ratio) >= need:
            cols += 1
        best = max(best, cols * rows)
    return best


def row_plan(n, cols, rows):
    """每行放哪几号素材。模型最容易犯的错是某行多塞一个，说清编号区间能压住。"""
    out = []
    for r in range(rows):
        lo, hi = r * cols + 1, min(n, (r + 1) * cols)
        if lo > n:
            break
        out.append((r + 1, lo, hi))
    return out


def rows_sentence(spans, cols, key_color):
    parts = []
    for r, lo, hi in spans:
        seg = 'row %d holds item %d' % (r, lo) if lo == hi \
            else 'row %d holds items %d-%d' % (r, lo, hi)
        if hi - lo + 1 < cols:
            seg += (' (only %d items in that row, left-aligned in the first %d cells; '
                    'the remaining cells stay completely empty and pure %s chroma-key)'
                    % (hi - lo + 1, hi - lo + 1, key_color))
        parts.append(seg)
    s = ', '.join(parts)
    return ('%s. Do not move an item to another row and do not put more or fewer '
            'items in a row than stated.' % (s[:1].upper() + s[1:]))


def compose(spec, variant, subs, size, key_color):
    items = spec['items']
    n = len(items)
    rows, cols = grid_of(n, size)
    geo = geometry(size, cols, rows)
    theme = spec.get('theme') or ''
    idx_of = {it['name']: i for i, it in enumerate(items, 1)}
    keep_names = variant != 'generic2'
    lines = []
    for i, it in enumerate(items, 1):
        d = (it.get('desc') or '').strip()
        base = it.get('base')
        if base and base in idx_of and idx_of[base] != i:
            d = '与第 %d 项完全同一个对象（相同外观、配色、比例），%s' % (idx_of[base], d)
        for a, b in subs:
            d = d.replace(a, b)
            theme = theme.replace(a, b)
        # sheet 外壳已定死整图背景（纯色 chroma-key 底），逐张时代残留在 desc 里的任何
        # 背景说明（透明背景 / 纯白底 / 白底 / 白色背景…）在这里都是矛盾指令，全部清掉；
        # 上游 asset_agent 补不补背景词都不稳定，所以清洗要覆盖整类词而不是单个词
        for _bg in ('透明背景', '纯白背景', '纯色背景', '白色背景', '纯白底', '白底',
                    '白背景', 'white background', 'transparent background'):
            d = d.replace(_bg, '')
        d = d.strip('，,、 ')
        lines.append('%d. %s: %s' % (i, it['name'], d) if keep_names else '%d. %s' % (i, d))
    theme = theme.strip('，,、 ')

    head = (
        'A single %s asset sheet for one game, drawn on a pure flat solid %s chroma-key '
        'background filling the entire canvas.\n'
        'Canvas: exactly %dx%d px, split into a strict %d-column x %d-row grid of '
        'identical cells, each cell exactly %dx%d px. Draw exactly one item per cell, '
        'centred in its own cell, filling the cells in reading order (left to right, '
        'then top to bottom). %s\n'
        'UNIFORM SIZE (hard requirement): every item must fit inside a centred %dx%d px '
        'box in its own cell, and must fill at least 60%% of that box. Nothing may be '
        'drawn larger than that box, and nothing may be shrunk far below it — all items '
        'share the same size envelope. No item may touch or cross into a neighbouring '
        'cell. Tall or long objects (flagpoles, pipes, ladders, spears) must be scaled '
        'down to fit the box, never drawn overflowing into the row above or below. '
        'Leave at least %d px of pure %s chroma-key between any two items and pure %s '
        'chroma-key all the way around every item. No cell borders, no grid lines, no '
        'labels, no text, no numbers, no watermark, no drop shadows, nothing touching or '
        'overlapping.\n'
        'Style: every item must share ONE single consistent style and ONE color palette '
        '— %s. %s\n'
        'The %s chroma-key background is removed automatically after generation, so no '
        'item may use that background colour (or any near-%s hue) anywhere in its own '
        'artwork, or it will be cut out. Inside the items themselves you are free to use '
        'white, light grey and any other colour as the art calls for.\n'
        'Inside that shared size box keep only modest relative-scale differences '
        '(characters near the top of the box, pickups and projectiles a little smaller); '
        'never break the box to make something look bigger.\n'
        'Items in reading order (left to right, then top to bottom):\n'
        % ('pixel-art' if spec.get('style', 'pixel') == 'pixel' else '2D game art',
           key_color, geo['canvas'][0], geo['canvas'][1], cols, rows,
           geo['cell'][0], geo['cell'][1],
           rows_sentence(row_plan(n, cols, rows), cols, key_color),
           geo['safe'][0], geo['safe'][1], geo['gap'], key_color, key_color,
           theme, STYLE.get(spec.get('style', 'pixel'), STYLE['pixel']),
           key_color, key_color))
    return head + '\n'.join(lines), rows, cols, geo



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('items')
    ap.add_argument('--out', required=True)
    ap.add_argument('--variant', default='verbatim',
                    choices=['verbatim', 'generic', 'generic2'])
    ap.add_argument('--subs')
    ap.add_argument('--size')
    a = ap.parse_args()

    with io.open(a.items, encoding='utf-8') as f:
        spec = json.load(f)
    if not spec.get('items'):
        print('items 为空', file=sys.stderr)
        sys.exit(1)
    size = a.size or spec.get('size') or '2848x1152'
    key_color = pick_key_color(spec)
    prompt, rows, cols, geo = compose(spec, a.variant, load_subs(a.variant, a.subs),
                                      size, key_color)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with io.open(a.out, 'w', encoding='utf-8') as f:
        f.write(prompt)
    plan = {'name': spec.get('name'), 'variant': a.variant, 'size': size,
            'key_color': key_color,
            'item_count': len(spec['items']), 'grid': '%dx%d' % (cols, rows),
            'cols': cols, 'rows': rows, 'cell': geo['cell'], 'safe': geo['safe'],
            'min_gap': geo['gap'],
            'names': [it['name'] for it in spec['items']], 'prompt_file': a.out}
    px = px_check(geo, spec.get('style'))
    plan.update(px)

    with io.open(os.path.splitext(a.out)[0] + '_plan.json', 'w', encoding='utf-8') as f:
        f.write(json.dumps(plan, ensure_ascii=False, indent=2))
    print(json.dumps(plan, ensure_ascii=False))
    if not px['px_ok']:
        print('分辨率预算不足：%d 个素材挤在一张 %s 上，每个只有 %d px '
              '（%s 风格交付 %d px，需要 %d px 余量）。这张图出来的素材会偏软，'
              '建议拆成两张 sheet，单张不超过 %d 个素材'
              % (len(spec['items']), size, px['px_budget'], spec.get('style') or 'pixel',
                 px['px_target'], px['px_need'], px['px_max_items']), file=sys.stderr)


if __name__ == '__main__':
    main()

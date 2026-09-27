#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把一张 asset sheet 切成单个素材。

用法:
  python3 slice_sheet.py <sheet.png> --out items/ [--plan prompt_plan.json]
                         [--expect 15] [--pad 16] [--report slice_report.json]
                         [--dilate 6] [--min-part 6] [--min-area 24] [--key-color #FF00FF]
                         [--min-gap-row 40] [--min-gap-col 80] [--min-side 16]
                         [--row-tol 160] [--no-grid] [--no-auto]

主算法 `grid`（`--plan` 里有 grid / item_count 时默认走这条）:
  1. 连通域标记（先按 `--dilate` 膨胀，把点阵抖动、描边缺口粘回同一块）
  2. 按 y 中心排序，在最大的 rows-1 个间隔处断行 —— 旗杆、管道这种高素材的
     中心落在哪行就算哪行，不会像整列扫底色那样把上下两行连成一片
  3. 行内反复合并「横向间隙最小的一对」，直到总块数正好等于 expect ——
     枪口火花、飘散粒子这类附属块离主体最近，会先被吸回主体
  4. 按行、行内按 x 排序，得到与 prompt 编号一致的阅读顺序

备用算法 `gap`（没有 `--plan`、没装 scipy、或 grid 凑不出 expect 时）: 先按整列纯底色
切列带，带内再按行切，切出数不符时扫 min_gap_* 参数（`--no-auto` 关掉）。
实测 4 张图：切得准的 3 张两条算法 box 完全一致，第 4 张只有 grid 切对。

**命名按行对齐**：某一行的块数和规划里该行的素材数一致时才用规划的名字；不一致的
那一行整行退化成 `unmatched_NN`，报告里 `names_reliable=false`。宁可让 distribute
把它记进 extra 不发布，也不能把 A 的图挂上 B 的名字 —— 错位命名会一路带到
manifest，比少几个素材危险得多。

每个素材都贴在一块比它大 pad 圈的纯 chroma-key 底画布上导出，**不做紧裁**：
clean_asset.py 从四边中位色反推 key 色再抠像，紧裁会让边框没有干净的 key 色带。
最小外接矩形交给后处理的 trim_content 做。

sheet 底色不再是白，而是 build_sheet_prompt.py 选定的 chroma-key 色（洋红 `#FF00FF`
默认，粉紫题材换绿 `#00FF00`），从 `--plan` 的 `key_color` 读，或用 `--key-color` 覆盖。
"""
import argparse, io, json, os, sys

import numpy as np
from PIL import Image

KEY_DIST = 80     # 距 key 色的欧氏距离超过此值算「有内容」（洋红灰度≈105，旧的 L<244 会误判）
DILATE = 6        # 连通域前的膨胀核，粘回点阵抖动造成的断裂
MIN_PART = 6      # 连通域碎块的最小边长
MIN_AREA = 24     # 连通域碎块的最小像素数
MIN_GAP_ROW = 40  # gap 算法：行间纯底像素高度
MIN_GAP_COL = 80  # gap 算法：列间纯底像素宽度
MIN_SIDE = 16     # gap 算法：边长小于此的碎块丢掉
ROW_TOL = 160     # y 中心相差超过此值算换行
DEFAULT_KEY = '#FF00FF'

# 几何安全闸阈值：切块相对「实际用的网格 cell」的形状约束。生图现在基本能画对网格，
# 一旦切块跨格/退化成细条/互相交叠，就是切割定区错了（连通域误判、agglomerate 错并），
# 数量对得上也不能算成功——这几条负责在「假成功」交付前把它拦下来。
SPAN_TOL = 1.4      # 切块宽/高 > cell 的这个倍数 = 跨进了邻格（该分的糊成一块）
SLIVER_TOL = 0.12   # 切块宽/高 < cell 的这个比例 = 退化细条（256x8 那种）
OVERLAP_TOL = 0.35  # 两切块交叠 > 较小块面积的这个比例 = 同一素材被切两半 / 错位
# reflow 判据：只有换成 dr 版式能让内部切割线少切穿这么大比例的内容时，才真的 reflow。
# plan 已画对时 plan 版式的 cost≈0，dr 版式（如把 3×2 塌成 1×6）会切穿大量素材、cost 高，
# 于是不 reflow —— 修掉「把画对的多列网格误塌成 1×N」的回归；而模型真把 2×2 画成 1×4 时，
# plan 版式的中缝会切穿整行、cost 高，dr 版式 cost 低，照样正确 reflow，兼容保留。
REFLOW_MARGIN = 0.03



def hex_to_rgb(h):
    h = (h or DEFAULT_KEY).lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def components(content, dilate, min_part, min_area):
    """连通域 → 每块的真实内容 bbox。没装 scipy 就返回 None，让调用方退回 gap 算法。"""
    try:
        from scipy import ndimage
    except ImportError:
        print('没装 scipy，grid 算法不可用，退回扫底色间隙', file=sys.stderr)
        return None
    st = np.ones((max(1, dilate), max(1, dilate)), bool)
    lab, _ = ndimage.label(ndimage.binary_dilation(content, st))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        ys, xs = sl
        if (xs.stop - xs.start < min_part or ys.stop - ys.start < min_part
                or int((lab[sl] == i).sum()) < min_area):
            continue
        sub = content[ys, xs]        # 膨胀会外扩，bbox 要按原始内容重算
        yy, xx = np.where(sub.any(axis=1))[0], np.where(sub.any(axis=0))[0]
        out.append((xs.start + int(xx[0]), ys.start + int(yy[0]),
                    xs.start + int(xx[-1]) + 1, ys.start + int(yy[-1]) + 1))
    return out


def split_rows(boxes, rows):
    """按 y 中心排序，在最大的 rows-1 个间隔处断行。行内按 x 排序。"""
    if not boxes:
        return []
    bs = sorted(boxes, key=lambda b: b[1] + b[3])
    if rows <= 1 or len(bs) <= rows:
        return [sorted(bs, key=lambda b: b[0])]
    cy = [(b[1] + b[3]) / 2.0 for b in bs]
    cuts = sorted(sorted(range(1, len(bs)), key=lambda i: cy[i] - cy[i - 1],
                         reverse=True)[:rows - 1])
    out, prev = [], 0
    for c in list(cuts) + [len(bs)]:
        if c > prev:
            out.append(sorted(bs[prev:c], key=lambda b: b[0]))
        prev = c
    return out


def detect_rows(boxes, max_rows=6):
    """从连通域 y 中心的自然间隙推断**实际**行数，不盲信 plan 写的行数。

    同一行的素材 y 中心相近；换行处有明显空隙（≳ 素材高度的一半）。用它兜住生图
    模型无视 plan 版式的两个方向：
      - 请求 4×1（rows=1）但模型排成 2×2 —— 实际行数比 plan 多，plan 若按单行切，
        左列上下叠放的两个素材会被当成同一行、糊成一块（hero_idle 事故）。
      - 请求 2×2（rows=2）但模型在窄扁画布上排成 1×4 —— 实际只有 1 行，plan 若按
        2 行硬切，会把单行内的 y 抖动误当换行，切成 [1,3]，命名全乱（teacher 事故）。
    """
    if len(boxes) <= 1:
        return 1
    cys = sorted((b[1] + b[3]) / 2.0 for b in boxes)
    heights = sorted(b[3] - b[1] for b in boxes)
    med_h = heights[len(heights) // 2]
    thresh = max(1.0, med_h * 0.6)
    rows = 1
    for i in range(1, len(cys)):
        if cys[i] - cys[i - 1] > thresh:
            rows += 1
    return min(rows, max_rows)


def agglomerate(groups, expect):
    """行内反复合并横向间隙最小的一对，直到总块数等于 expect。返回 (行分组, 合并间隙)。"""
    groups = [list(g) for g in groups]
    merges, total = [], sum(len(g) for g in groups)
    while expect and total > expect:
        best = None
        for gi, g in enumerate(groups):
            for i in range(len(g) - 1):
                d = g[i + 1][0] - g[i][2]        # 横向间隙，重叠为负
                if best is None or d < best[0]:
                    best = (d, gi, i)
        if best is None:
            break
        d, gi, i = best
        g, a, b = groups[gi], groups[gi][i], groups[gi][i + 1]
        g[i:i + 2] = [(min(a[0], b[0]), min(a[1], b[1]),
                       max(a[2], b[2]), max(a[3], b[3]))]
        merges.append(d)
        total -= 1
    return groups, merges


def grid_cut_cost(content, cols, rows):
    """按 cols×rows 均分网格，落在内部切割线上的内容像素占比。值越低 = 切割线越贴着
    素材间的空白走 = 这个版式和实际画面越吻合。reflow 只在「换成 dr 版式能明显少切穿
    素材」时才做，避免把已画对的多列网格塌成 1×N（那种误塌会切穿一整行，cost 很高）。"""
    h, w = content.shape
    tot = float(content.sum()) or 1.0
    mask = np.zeros((h, w), bool)
    if cols > 1:
        bx = max(1, int(w / cols * 0.05))
        for i in range(1, cols):
            c = int(round(i * w / float(cols)))
            mask[:, max(0, c - bx):c + bx + 1] = True
    if rows > 1:
        by = max(1, int(h / rows * 0.05))
        for i in range(1, rows):
            c = int(round(i * h / float(rows)))
            mask[max(0, c - by):c + by + 1, :] = True
    return float((content & mask).sum()) / tot


def geom_violations(boxes, canvas, cols, rows):
    """校验切块几何：跨格的大框、退化的细条、互相交叠的框都算异常。返回违规切块的
    下标集合（1-based）。空集 = 几何看起来正常。cell 尺寸按实际 sheet 尺寸/实际网格算。"""
    w, h = canvas
    cw = w / float(max(1, cols))
    ch = h / float(max(1, rows))
    bad = set()
    for i, (x0, y0, x1, y1) in enumerate(boxes, 1):
        bw, bh = x1 - x0, y1 - y0
        if bw > SPAN_TOL * cw or bh > SPAN_TOL * ch:      # 跨进了邻格
            bad.add(i)
        if bw < SLIVER_TOL * cw or bh < SLIVER_TOL * ch:  # 退化成细条
            bad.add(i)
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            ax0, ay0, ax1, ay1 = boxes[i]
            bx0, by0, bx1, by1 = boxes[j]
            ix = max(0, min(ax1, bx1) - max(ax0, bx0))
            iy = max(0, min(ay1, by1) - max(ay0, by0))
            inter = ix * iy
            if inter <= 0:
                continue
            amin = min((ax1 - ax0) * (ay1 - ay0), (bx1 - bx0) * (by1 - by0)) or 1
            if inter > OVERLAP_TOL * amin:                # 同一素材被切两半 / 错位交叠
                bad.add(i + 1)
                bad.add(j + 1)
    return sorted(bad)



def spans(has, min_gap):
    """把布尔序列切成若干连续 True 段，段间空白 < min_gap 的会被合并。"""
    out, i, n = [], 0, len(has)
    while i < n:
        if not has[i]:
            i += 1
            continue
        j = i
        while j < n:
            if has[j]:
                j += 1
                continue
            k = j
            while k < n and not has[k]:
                k += 1
            if k - j < min_gap and k < n:
                j = k
            else:
                break
        out.append((i, j))
        i = j
    return out


def boxes_of(content, col_has, gap_col, gap_row, min_side, cache):
    """gap 算法：先切列带（按 gap_col 缓存），带内再按行切。"""
    if gap_col not in cache:
        bands = []
        for x0, x1 in spans(col_has, gap_col):
            band = content[:, x0:x1]
            bands.append((x0, band, band.any(axis=1).tolist()))
        cache[gap_col] = bands
    out = []
    for x0, band, row_has in cache[gap_col]:
        for y0, y1 in spans(row_has, gap_row):
            sub = band[y0:y1]
            xs = np.where(sub.any(axis=0))[0]
            ys = np.where(sub.any(axis=1))[0]
            if not len(xs) or not len(ys):
                continue
            bx0, bx1 = x0 + int(xs[0]), x0 + int(xs[-1]) + 1
            by0, by1 = y0 + int(ys[0]), y0 + int(ys[-1]) + 1
            if bx1 - bx0 < min_side or by1 - by0 < min_side:
                continue
            out.append((bx0, by0, bx1, by1))
    return out


def candidates(gap_row, gap_col):
    """扫参数顺序：先只动行间隙（最常见的病因），再动列间隙，最后小范围交叉。"""
    rows = [32, 24, 20, 16, 12, 10, 8, 6, 48, 64, 80, 100]
    cols = [64, 48, 40, 32, 100, 120, 160]
    seen, out = {(gap_row, gap_col)}, []
    for r in rows:
        out.append((r, gap_col))
    for c in cols:
        out.append((gap_row, c))
    for r in rows[:6]:
        for c in cols[:4]:
            out.append((r, c))
    return [p for p in out if not (p in seen or seen.add(p))]


def gap_slice(content, a, expect):
    """gap 算法全流程：默认参数切一遍，不符就扫参数。返回 (boxes, 用的参数, 试过的)。"""
    col_has = content.any(axis=0).tolist()
    cache, tried = {}, []

    def attempt(gr, gc):
        b = boxes_of(content, col_has, gc, gr, a.min_side, cache)
        tried.append({'mode': 'gap', 'min_gap_row': gr, 'min_gap_col': gc,
                      'sliced': len(b)})
        return b

    used = (a.min_gap_row, a.min_gap_col)
    boxes = attempt(*used)
    if expect is not None and len(boxes) != expect and not a.no_auto:
        for gr, gc in candidates(*used):
            b = attempt(gr, gc)
            if len(b) == expect:
                return b, (gr, gc), tried
    return boxes, used, tried


def row_groups(boxes, row_tol):
    """gap 算法的结果没有行结构，按 y 中心聚类补出来，供命名对齐用。"""
    rows = []
    for b in sorted(boxes, key=lambda b: (b[1] + b[3]) / 2.0):
        cy = (b[1] + b[3]) / 2.0
        if rows and abs(cy - rows[-1][1]) <= row_tol:
            rows[-1][0].append(b)
        else:
            rows.append(([b], cy))
    return [sorted(r, key=lambda b: b[0]) for r, _ in rows]


def name_rows(groups, names, cols):
    """按行对齐取名。行内块数和规划里该行的素材数不一致时，整行退化成 None。"""
    if not names:
        return [None] * sum(len(g) for g in groups), True
    out, ok = [], True
    for r, g in enumerate(groups):
        want = names[r * cols:(r + 1) * cols] if cols else []
        if want and len(want) == len(g):
            out += want
        else:
            ok = False
            out += [None] * len(g)
    return out, ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--out', required=True)
    ap.add_argument('--plan', help='build_sheet_prompt.py 产出的 *_plan.json：'
                                   '提供 names / item_count / grid')
    ap.add_argument('--expect', type=int)
    ap.add_argument('--rows', type=int, help='网格行数，默认从 --plan 的 grid 取')
    ap.add_argument('--pad', type=int, default=16)
    ap.add_argument('--report')
    ap.add_argument('--key-color', dest='key_color',
                    help='sheet 的 chroma-key 底色（如 #FF00FF）；默认从 --plan 的 '
                         'key_color 读，都没有则 #FF00FF')
    ap.add_argument('--key-dist', type=int, default=KEY_DIST,
                    help='距 key 色的距离超过此值算有内容')
    ap.add_argument('--dilate', type=int, default=DILATE)
    ap.add_argument('--min-part', type=int, default=MIN_PART)
    ap.add_argument('--min-area', type=int, default=MIN_AREA)
    ap.add_argument('--min-gap-row', type=int, default=MIN_GAP_ROW)
    ap.add_argument('--min-gap-col', type=int, default=MIN_GAP_COL)
    ap.add_argument('--min-side', type=int, default=MIN_SIDE)
    ap.add_argument('--row-tol', type=int, default=ROW_TOL)
    ap.add_argument('--no-grid', action='store_true',
                    help='不用连通域 grid 算法，直接扫底色间隙')
    ap.add_argument('--no-auto', action='store_true',
                    help='gap 算法切出数不符时不要自动扫 min_gap_* 参数')
    a = ap.parse_args()

    names, expect, rows, cols = [], a.expect, a.rows, None
    plan_key = None
    if a.plan and os.path.exists(a.plan):
        p = json.load(io.open(a.plan, encoding='utf-8'))
        names = p.get('names') or []
        expect = expect or p.get('item_count')
        plan_key = p.get('key_color')
        g = str(p.get('grid') or '')
        if 'x' in g:
            cols, gr = [int(x) for x in g.split('x')[:2]]
            rows = rows or gr
        cols = p.get('cols') or cols
        rows = rows or p.get('rows')

    key_hex = a.key_color or plan_key or DEFAULT_KEY
    key = np.array(hex_to_rgb(key_hex), dtype=np.float32)

    sheet = Image.open(a.sheet).convert('RGB')
    # 内容掩码：离 key 色够远才算有内容。旧的「灰度 < 244」在洋红底上会把底当成内容
    # （洋红灰度≈105），所以按到 key 色的欧氏距离判定。
    arr = np.asarray(sheet, dtype=np.float32)
    content = np.linalg.norm(arr - key, axis=2) > a.key_dist

    cand, tried, merges, comps = [], [], [], None
    eff_rows, eff_cols, reflowed = rows, cols, False
    if not a.no_grid and rows and expect:
        comps = components(content, a.dilate, a.min_part, a.min_area)
    if comps:
        # 生图模型有时无视 plan 的行列，两个方向都会犯：
        #   行数变多——请求 4×1 却排成 2×2（plan 按单行切会把上下叠放的两块糊成一块）；
        #   行数变少——请求 2×2 却在窄扁画布上排成 1×4（plan 按 2 行硬切，会把单行的
        #     y 抖动误当成换行，切成 [1,3] 之类，整表命名对不齐）。
        # 但连通域反推的行数 dr 并不可靠：HD art 主体被 chroma 打碎成几十个碎块时，
        # detect_rows 会把碎块间的竖缝也当换行，把一个画对的 3×2 数成 6 行，旧判据
        # `dr != rows and expect%dr==0` 就把它误塌成 1×6，整行横切成宽条（假成功回归）。
        # 所以不再只看行数是否相等，而是比「哪个版式的内部切割线更少切穿素材」：只有
        # dr 版式的 cost 比 plan 版式明显低（低过 REFLOW_MARGIN）才真的 reflow ——
        # plan 画对时 plan_cost≈0，dr 版式切穿一整行 cost 高，不 reflow；模型真把 2×2
        # 画成 1×4 时，plan 的中缝切穿整行 cost 高、dr 版式 cost 低，照样正确 reflow。
        dr = detect_rows(comps)
        if rows and dr >= 1 and dr != rows and expect % dr == 0:
            plan_cost = grid_cut_cost(content, cols or eff_cols or 1, rows)
            dr_cost = grid_cut_cost(content, expect // dr, dr)
            if dr_cost + REFLOW_MARGIN < plan_cost:
                eff_rows, eff_cols, reflowed = dr, expect // dr, True

        g, merges = agglomerate(split_rows(comps, eff_rows), expect)
        tried.append({'mode': 'grid', 'components': len(comps),
                      'sliced': sum(len(x) for x in g)})
        cand.append(('grid', g))
    if not cand or sum(len(x) for x in cand[0][1]) != expect:
        # grid 凑不出 expect（素材真的粘在一起），才退回扫底色间隙
        boxes, gused, gtried = gap_slice(content, a, expect)
        tried += gtried
        cand.append(('gap', row_groups(boxes, a.row_tol)))
    mode, groups = next((c for c in cand
                         if expect and sum(len(x) for x in c[1]) == expect), cand[0])
    boxes = [b for g in groups for b in g]
    picked, name_reliable = name_rows(groups, names, eff_cols)

    # 几何安全闸：数量凑够 ≠ 切对。连通域误判 / agglomerate 错并会切出跨格的糊块、
    # 退化的细条、互相交叠的框，长宽比对账查不出来（数量照样等于 expect）。这里按实际
    # sheet 尺寸和实际网格算 cell，形状异常的切块标出来：不给规划名字（→ unmatched，
    # distribute 不发布、记 missing），并置 names_reliable=false，让 run_pipeline 的
    # next_action 报 geom_violation 触发重切/记缺，而不是把糊块当成功交付。
    geom_bad = []
    if mode == 'grid' and eff_cols and eff_rows:
        geom_bad = geom_violations(boxes, list(sheet.size), eff_cols, eff_rows)
        for gi in geom_bad:
            picked[gi - 1] = None
    geom_ok = not geom_bad
    reliable = name_reliable and geom_ok
    fallback = 'item_%02d' if not names else 'unmatched_%02d'



    os.makedirs(a.out, exist_ok=True)
    key_rgb = tuple(int(v) for v in hex_to_rgb(key_hex))
    items = []
    for i, (x0, y0, x1, y1) in enumerate(boxes, 1):
        nm = picked[i - 1] or (fallback % i)
        crop = sheet.crop((x0, y0, x1, y1))
        # 贴到 key 色画布上：保证四边都有干净的纯 key 色边框，clean_asset 才能从边框
        # 中位色反推出 key 色并抠净
        canvas = Image.new('RGB', (crop.width + a.pad * 2, crop.height + a.pad * 2),
                           key_rgb)
        canvas.paste(crop, (a.pad, a.pad))
        fn = '%02d_%s.png' % (i, nm)
        canvas.save(os.path.join(a.out, fn))
        items.append({'index': i, 'name': nm, 'file': fn,
                      'named': picked[i - 1] is not None,
                      'box': [x0, y0, x1, y1],
                      'size': '%dx%d' % (crop.width, crop.height),
                      'padded_size': '%dx%d' % (canvas.width, canvas.height)})

    rep = {'sheet': a.sheet, 'sheet_size': '%dx%d' % sheet.size, 'mode': mode,
           'expect': expect, 'sliced': len(items),
           'match': (expect is None or expect == len(items)),
           'names_reliable': reliable,
           'geom_ok': geom_ok,
           'geom_bad': geom_bad,
           'grid': '%sx%s' % (eff_cols, eff_rows),
           'plan_grid': '%sx%s' % (cols, rows),
           'grid_reflowed': reflowed,
           'components': len(comps) if comps else None,
           'row_counts': [len(g) for g in groups],
           'merge_gaps': merges, 'pad': a.pad, 'key_color': key_hex,
           'params': {'key_dist': a.key_dist, 'dilate': a.dilate,
                      'min_part': a.min_part, 'min_area': a.min_area,
                      'min_gap_row': a.min_gap_row, 'min_gap_col': a.min_gap_col,
                      'min_side': a.min_side, 'row_tol': a.row_tol},
           'tried': tried, 'items': items}
    if a.report:
        os.makedirs(os.path.dirname(os.path.abspath(a.report)), exist_ok=True)
        with io.open(a.report, 'w', encoding='utf-8') as f:
            f.write(json.dumps(rep, ensure_ascii=False, indent=2))
    print(json.dumps({k: rep[k] for k in
                      ('sheet_size', 'mode', 'expect', 'sliced', 'match',
                       'names_reliable', 'geom_ok', 'grid', 'grid_reflowed',
                       'row_counts')},
                     ensure_ascii=False))
    if reflowed:
        print('实际连通域行数(%d)与 plan(%s)不符，且 dr 版式明显更贴素材间空白，已按几何'
              '重排成 %sx%s 切割/命名 —— 多半是生图模型没按请求版式画（请求 4×1 却排成 '
              '2×2，或请求 2×2 却在窄扁画布上排成 1×4）。命名仍按阅读顺序，若 '
              'names_reliable=false 请核对 slice_report 的 row_counts'
              % (eff_rows, rows, eff_cols, eff_rows), file=sys.stderr)
    if geom_bad:
        print('几何安全闸拦下 %d 个切块 %s（跨格糊块/退化细条/互相交叠，见 slice_report '
              'geom_bad）：版式凑够数但切块形状不对，八成是切割定区错位（连通域误判、'
              'agglomerate 错并），已标 unmatched 不发布避免把糊块/细条当成功交付；'
              '改 --dilate 10 --pad 24 重切，或把这几个 key 记 missing'
              % (len(geom_bad), geom_bad), file=sys.stderr)
    if not name_reliable:
        print('有行的块数和规划不符，那一行已改名 unmatched_NN 不发布（见 '
              'slice_report.json 的 row_counts / items[].named）', file=sys.stderr)
    if expect is not None and expect != len(items):
        # 两条算法都凑不出 expect：素材在图上真的粘成一块了。下面这张表就是全部结果，
        # 不要再自己写探针 —— 改 --pad / --dilate 重切，或把缺的素材记 missing。
        print('切出数 %d != 期望 %d；试过: %s'
              % (len(items), expect, json.dumps(tried[:24], ensure_ascii=False)),
              file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()






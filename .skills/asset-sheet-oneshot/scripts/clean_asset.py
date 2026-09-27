#!/usr/bin/env python3
"""
通用素材清洗：chroma-key 去底（纯平洋红/绿等高饱和底）+ 处理透明区域。

设计约束：算法入口 clean_image(path) 只接受一个图片路径。所有判断都从像素统计里
推出来 —— 不读 manifest.json、不看文件名、不接受「这是砖块 / 这是精灵」之类的外部提示，
也不需要旁路告诉它 key 色是什么：key 色从画布四边的中位色自动反推（slice_sheet.py
给每块素材垫的就是纯 key 色边框，四边中位色即 key 色）。

为什么不再抠白底：白会和素材内容撞（白高光、白手套、白描边、雪、云都无法和白底区分），
逼着上游 prompt 禁止素材用白、逼着这里堆一堆猜测式补丁（内部白孤岛、清白边残留、
55% 边界判据、抠完回滚）。改到高饱和 chroma 底（洋红 #FF00FF 默认，粉紫题材换绿
#00FF00）后，底色在美术里几乎不出现，撞色问题消失：素材内部重新允许自由用白，
抠像只按「离 key 色多远」算软 alpha，边缘质量也更好。

处理链（每一步都是有条件触发的，条件不满足就跳过并记录原因）：

  1. detect_key       从四边中位色反推 key 色并判类型：
       alpha    已经有真 alpha（透明像素 >= 2%），不动
       chroma   四边中位色是高饱和彩色（洋红/绿等）→ 这是 chroma 底，按距离抠像
       none     四边中位色是低饱和（白/灰/黑/近灰）→ 不是 chroma 底，判为画面内容
                （背景层、满幅砖块）不抠。chroma 抠像只移除接近 key 色的像素，实心
                砖块本就不含 key 色、天然不受影响，所以不再需要 opaque_art 保护判定。

  2. apply_chroma_key 按到 key 色的欧氏距离算软 alpha（transparent~opaque 之间 smoothstep），
                      再用 key 主导度（spill 通道减非 spill 通道）识别半透明边缘，
                      despill 压掉边缘溢色，最后 contract（收边一圈去彩边）+ feather（羽化）。

  3. normalize_alpha  alpha<=8 归 0、>=248 归 255，清掉半透明浮尘。

  4. full_bleed       只对「看起来是一块砖」的图做满幅出血（画布近正方、<=128px、内容框
                      内实心率 >= 97%、覆盖 35%~99.5%、放大不超过 1.4 倍且横纵形变 <= 1.15）。
                      实心率这一条把圆形的金币（80%）和带透明缝的精灵表（27%）挡在外面。
                      出血后 alpha 直接拉满，连排平铺不露缝。

  5. trim_content     裁掉透明留白，让图等于主体的最小外接矩形。这一步会改变画布尺寸，
                      所以对序列帧必须特殊处理：
                        detect_grid   纯像素推断序列帧网格（格边界那两列/两行是否干净、
                                      或格子本身是正方；再要求非空格子 >= 80%、
                                      帧数 2~64、格子边长 >= 16）。
                        单帧图        直接裁到 alpha>0 的外接矩形。
                        序列帧        取「所有格子在格内局部坐标下的外接矩形的并集」，
                                      再对每一格裁同一个矩形后重新拼回去。并集保证
                                      不会切掉任何一个不透明像素，同一矩形保证各帧
                                      的相对对齐不变（否则动画会逐帧抖动）。
                      推不出网格、又不是单帧的图不裁，宁可留边距也不赌网格。

  6. bleed_rgb        把不透明像素的 RGB 扩散进透明区域。透明像素的 RGB 若是纯白或纯黑，
                      一旦被平滑缩放（imageSmoothingEnabled 默认 true、CSS 缩放、mipmap）
                      就会在轮廓外漏出一圈白边/黑边。

注意：第 5 步改尺寸，下游代码里写死的 frameWidth/frameHeight 会失效。_report.json 的
trim 字段记录了原尺寸、新尺寸、裁切偏移和网格，按它更新代码常量即可。

用法:
  python3 clean_asset.py <图片路径> [-o 输出路径]     处理单张图
  python3 clean_asset.py --batch [代码包根目录]        批量处理所有 app 的 src/assets
依赖: pillow numpy scipy
"""
import os, sys, json, glob, shutil
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

DEFAULT_CODE_ROOT = "/Users/chengxuyi/Downloads/资产库需求/data/code/0920-game-asset-d24"
DEFAULT_OUT_ROOT = "/Users/chengxuyi/Downloads/资产库需求/data/handle_image"
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".bmp")

# ---- chroma-key 阈值。移植自 generate-vn-portrait 立绘 skill，实测稳定，改动前先小图验证 ----
DEFAULT_KEY_COLOR = (255, 0, 255)   # 反推不出时的兜底 key 色（洋红）
ALPHA_PRESENT = 0.02        # 透明像素占比超过此值 → 认为素材已有真 alpha，不再 key
TRANSPARENT_THRESHOLD = 14.0   # 到 key 色的 RGB 距离 <= 此值算全透明
OPAQUE_THRESHOLD = 190.0       # 距离 >= 此值算全不透明；中间 smoothstep 过渡
KEY_DOMINANCE_THRESHOLD = 24.0 # key 主导度 >= 此值也算「像 key 色」（抓半透明边缘）
KEY_LIKE_DIST = 32.0        # 距离 <= 此值直接算「像 key 色」
ALPHA_NOISE_FLOOR = 2       # 抠完后 0<alpha<=此值的浮尘归 0
EDGE_CONTRACT = 1           # 收边像素数：把 alpha 蒙版向内缩，去掉一圈残留彩边
EDGE_FEATHER = 0.25         # 收边后对 alpha 做的高斯羽化半径
CHROMA_MIN_SAT = 60         # 四边中位色 max-min >= 此值才算高饱和 chroma 底（白/灰达不到）

# ---- 满幅出血 / 序列帧网格阈值（与底色类型无关，保持不变） ----
TILE_MAX_SIDE = 128     # 满幅出血只考虑边长不超过此值的图
GUTTER_TOL = 0.02       # 格子边界上允许的内容占比（帧与帧之间的缝应当基本是空的）
GRID_USED = 0.50        # 网格里非空格子的比例下限（配合「非空格子必须是行优先前缀」使用）
GRID_MAX_FRAMES = 64    # 帧数上限。没有这条，1376x768 的背景层会被当成 43x24=1032 帧
GRID_MIN_CELL = 16      # 格子边长下限
GRID_ASPECT = 1.6       # 非正方格子的长宽比上限（27x81 的图标、2560x640 的条带都被挡在外面）
GRID_BBOX_CV = 0.25     # 各格内容外接矩形尺寸的变异系数上限（同一动画的每帧体型应当接近）


# ============================ 基础工具 ============================

def content_bbox(a, thr=8):
    m = a[:, :, 3] > thr
    if not m.any():
        return None
    ys, xs = np.where(m)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def _smoothstep(v):
    v = np.clip(v, 0.0, 1.0)
    return v * v * (3.0 - 2.0 * v)


def infer_border_key(rgb, sample_px=8):
    """四边各取 sample_px 圈像素的中位色作为 key 色。slice_sheet 垫的纯 key 色边框
    让这个中位数恰好等于 key 色，clean_asset 因此不需要旁路告知 key 是什么。"""
    h, w = rgb.shape[:2]
    s = max(1, min(sample_px, h // 2 or 1, w // 2 or 1))
    border = np.concatenate([
        rgb[:s, :, :].reshape(-1, 3), rgb[h - s:, :, :].reshape(-1, 3),
        rgb[:, :s, :].reshape(-1, 3), rgb[:, w - s:, :].reshape(-1, 3)], axis=0)
    med = np.median(border, axis=0)
    return tuple(int(round(v)) for v in med)


def _spill_channels(key):
    """key 色里「高值」的通道（会向素材边缘溢色的通道）。洋红→R,B；绿→G。
    低亮度 key（max<128）返回空，视作不做 chroma。"""
    km = max(key)
    if km < 128:
        return []
    return [i for i, v in enumerate(key) if v >= km - 16 and v >= 128]


def _key_dominance(rgb, key):
    """key 主导度：spill 通道的强度减去非 spill 通道的强度。半透明边缘上仍为正。"""
    ch = _spill_channels(key)
    if not ch:
        return np.zeros(rgb.shape[:2], dtype=np.float32)
    spill = rgb[:, :, ch]
    key_str = spill.min(axis=2) if len(ch) > 1 else spill[:, :, 0]
    non = [i for i in range(3) if i not in ch]
    non_str = rgb[:, :, non].max(axis=2) if non else np.zeros(rgb.shape[:2], np.float32)
    return key_str - non_str


def _dominance_alpha(rgb, key):
    ch = _spill_channels(key)
    if not ch:
        return np.full(rgb.shape[:2], 255.0, dtype=np.float32)
    dom = _key_dominance(rgb, key)
    non = [i for i in range(3) if i not in ch]
    non_str = rgb[:, :, non].max(axis=2) if non else np.zeros(rgb.shape[:2], np.float32)
    denom = np.maximum(1.0, float(max(key)) - non_str)
    alpha = 1.0 - np.clip(dom / denom, 0.0, 1.0)
    return np.where(dom > 0, alpha * 255.0, 255.0)


def apply_chroma_key(a, key):
    """按到 key 色的距离抠像：软 alpha + key 主导度 + despill + 收边 + 羽化。
    返回 (新 RGBA 数组, 抠掉的像素占比)。"""
    rgba = a.astype(np.float32)
    rgb = rgba[:, :, :3]
    in_a = rgba[:, :, 3]
    ka = np.array(key, dtype=np.float32)
    dist = np.linalg.norm(rgb - ka, axis=2)

    ratio = (dist - TRANSPARENT_THRESHOLD) / max(1.0, OPAQUE_THRESHOLD - TRANSPARENT_THRESHOLD)
    soft = _smoothstep(ratio) * 255.0
    dom = _key_dominance(rgb, key)
    key_like = (dist <= KEY_LIKE_DIST) | (dom >= KEY_DOMINANCE_THRESHOLD)
    out_a = np.where(key_like, np.minimum(soft, _dominance_alpha(rgb, key)), 255.0)
    out_a = out_a * (in_a / 255.0)
    out_a = np.where((out_a > 0) & (out_a <= ALPHA_NOISE_FLOOR), 0.0, out_a)

    # despill：边缘上被 key 染色的 spill 通道压回非 spill 通道的水平，去掉洋红/绿溢色
    ch = _spill_channels(key)
    non = [i for i in range(3) if i not in ch]
    if ch and non:
        anchor = rgb[:, :, non].max(axis=2)
        cap = np.maximum(0.0, anchor - 1.0)
        mask = key_like & (out_a < 252.0)
        for i in ch:
            rgb[:, :, i] = np.where(mask & (rgb[:, :, i] > cap), cap, rgb[:, :, i])

    rgb = np.where(out_a[:, :, None] == 0, 0, rgb)
    rgba[:, :, :3] = np.clip(rgb, 0, 255)
    rgba[:, :, 3] = np.clip(out_a, 0, 255)
    img = Image.fromarray(rgba.astype(np.uint8), "RGBA")

    if EDGE_CONTRACT > 0:                       # 收边：向内缩几像素，削掉一圈残留彩边
        al = img.getchannel("A")
        for _ in range(EDGE_CONTRACT):
            al = al.filter(ImageFilter.MinFilter(3))
        img.putalpha(al)
    if EDGE_FEATHER > 0:                        # 羽化：抠像边界稍微软化
        img.putalpha(img.getchannel("A").filter(ImageFilter.GaussianBlur(radius=EDGE_FEATHER)))

    res = np.array(img)
    frac = float((res[:, :, 3] == 0).mean())
    return res, frac


# ============================ 1. key 色与底类型判定 ============================

def detect_key(a):
    """判断底的类型并反推 key 色。已有真 alpha 就不动；四边中位色是高饱和彩色才算
    chroma 底；低饱和（白/灰/黑）判为画面内容不抠。"""
    al = a[:, :, 3].astype(int)
    trans = float((al == 0).mean())
    if trans >= ALPHA_PRESENT:
        return {"kind": "alpha", "transparent": round(trans, 4)}
    rgb = a[:, :, :3].astype(np.float32)
    key = infer_border_key(rgb)
    sat = max(key) - min(key)
    if sat < CHROMA_MIN_SAT or not _spill_channels(key):
        return {"kind": "none", "border_key": list(key), "border_sat": int(sat)}
    return {"kind": "chroma", "key": list(key), "border_sat": int(sat)}


# ============================ 2. 透明区域整理 ============================

def normalize_alpha(a):
    """alpha<=8 归 0、>=248 归 255。清掉抠底和生成过程留下的半透明浮尘。"""
    out = a.copy()
    al = out[:, :, 3].astype(int)
    dust = (al > 0) & (al <= 8)
    solid = (al >= 248) & (al < 255)
    out[dust, 3] = 0
    out[solid, 3] = 255
    return out, int(dust.sum() + solid.sum())


# ============================ 3. 满幅出血 ============================

def looks_like_tile(a):
    """
    判断这张图是不是「该满幅平铺的一块砖」。全部靠几何统计，不看文件名。

    关键一条是内容框内的实心率：砖块是实心矩形（~100%），圆形金币只有 80%，
    带透明缝的精灵表只有 27%。没有这一条就会把精灵拉伸成满幅，直接毁图。
    """
    h, w = a.shape[:2]
    bb = content_bbox(a)
    if bb is None:
        return False, "空图"
    x0, y0, x1, y1 = bb
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    fill = float((a[:, :, 3] > 8)[y0:y1 + 1, x0:x1 + 1].mean())
    cov = bw * bh / float(w * h)
    sx, sy = w / bw, h / bh
    if max(w, h) > TILE_MAX_SIDE:
        return False, f"{w}x{h} 超过 {TILE_MAX_SIDE}px，不像单块 tile"
    if abs(w - h) > 0.1 * max(w, h):
        return False, f"画布 {w}x{h} 不接近正方"
    if fill < 0.97:
        return False, f"内容框内实心率 {fill * 100:.0f}%<97%，是精灵不是砖块"
    if not 0.35 <= cov < 0.995:
        return False, f"内容覆盖 {cov * 100:.1f}% 不在 35%~99.5%"
    if max(sx, sy) > 1.4 or max(sx / sy, sy / sx) > 1.15:
        return False, f"出血需放大 {sx:.2f}x/{sy:.2f}x，形变过大"
    return True, f"内容 {bw}x{bh} 实心 {fill * 100:.0f}%，出血 {sx:.2f}x/{sy:.2f}x"


def full_bleed(a):
    """裁掉内容框外的透明边 → NEAREST 放回原尺寸 → alpha 全拉 255，连排平铺不露缝。"""
    h, w = a.shape[:2]
    x0, y0, x1, y1 = content_bbox(a)
    crop = a[y0:y1 + 1, x0:x1 + 1]
    out = np.array(Image.fromarray(crop).resize((w, h), Image.NEAREST))
    out[:, :, 3] = 255
    return out


# ======================= 4. 裁到主体最小外接矩形 =======================

def _divisors(n):
    return [d for d in range(1, n + 1) if n % d == 0]


def _cell_boxes(al, cols, rows, cw, ch):
    """各格内容在格内局部坐标下的外接矩形，跳过空格。"""
    out = []
    for r in range(rows):
        for c in range(cols):
            cell = al[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            if not cell.any():
                continue
            ys, xs = np.where(cell)
            out.append((int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
    return out


def detect_grid(al):
    """
    纯像素推断序列帧网格，返回 (cols, rows, cell_w, cell_h) 或 None。

    候选 = w 的约数 × h 的约数。一个候选要成为网格，必须满足：
      a) 两轴的格子边界都干净（内部边界那两列/两行的内容占比 <= 2%）；
         或者格子是正方、且至少有一个轴的边界是干净的。后半条是为 5120x640 这类精灵表
         留的：它们有一半在 640 竖界上有内容溢出（最狠的一条占到 68.6%），只看「边界干净」
         会全部漏掉；而 rows=1 时横向没有内部边界，该轴天然算干净，正方格子就把它捞回来。
         「至少一个轴干净」这一条是必需的 —— 少了它，256x256 的单个箭头会被当成
         2x2 的 128px 网格（四格都有内容，b) 拦不住），并集矩形正好等于整格，白裁一场空。
      b) 有内容的格子必须正好是「行优先顺序下的前缀」，且至少占 50%。序列帧是按行填的，
         用不满的格子只会空在末尾（语料里 288x288 的 explosion 是 3x3 只用了前 6 格，
         e18 的 3x3 表空的是第 9 格）。这条同时挡住「切碎」型误判：576x432 的 3x3 表
         若按 64px 切成 9x3=27 格，窄身角色恰好能落进 64 宽的带里从而通过 a)，
         但那 9 个有内容的格子是散布的，不构成前缀。
      c) 各格内容外接矩形的尺寸变异系数（CV）。同一段动画每帧是同一个角色，体型接近，
         所以 CV 低的候选更可能是真网格。它只在候选之间做比较，不做绝对淘汰：
         288x216 的 3x3 表还能被切成 4x3 的 72px 方格（11 格有内容，b) 放行），
         但那样切出来的 CV 是 0.38，正确的 3x3 是 0.13；576x432 的一对是 0.34 对 0.02。
         选法是「CV <= max(0.25, 1.5 倍最小 CV) 的候选里取帧数最多的」，兼顾另一头：
         2560x1280 的 4x2（CV 0.10）要能赢过同样合法的 2x1（CV 0.02），否则少裁一半。
         做成绝对阈值会误杀爆炸/死亡这类逐帧体型剧变的真序列帧 —— 本语料有 5 张
         CV 都超过 0.25，而它们只有一个候选、本来就是对的。
      d) 帧数 2~64、格子边长 >= 16、非正方格子的长宽比 <= 1.6。
         帧数上限是必需的：1376x768 的中景层与 32 的公约数会给出 43x24=1032 格，
         每格都有内容，b) 拦不住它。
    """
    h, w = al.shape
    clean_w = {cw for cw in _divisors(w)
               if all(al[:, k * cw - 1].mean() <= GUTTER_TOL and al[:, k * cw].mean() <= GUTTER_TOL
                      for k in range(1, w // cw))}
    clean_h = {ch for ch in _divisors(h)
               if all(al[k * ch - 1].mean() <= GUTTER_TOL and al[k * ch].mean() <= GUTTER_TOL
                      for k in range(1, h // ch))}
    cands = []
    for cw in _divisors(w):
        for ch in _divisors(h):
            cols, rows = w // cw, h // ch
            n = cols * rows
            if not 2 <= n <= GRID_MAX_FRAMES:
                continue
            if min(cw, ch) < GRID_MIN_CELL or max(cw, ch) / min(cw, ch) > GRID_ASPECT:
                continue
            strict = cw in clean_w and ch in clean_h
            square = cw == ch and (cw in clean_w or ch in clean_h)
            if not (strict or square):
                continue
            filled = [bool(al[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw].any())
                      for r in range(rows) for c in range(cols)]
            used = sum(filled)
            if used < 2 or used / n < GRID_USED:
                continue
            if filled[:used] != [True] * used:   # 有内容的格子必须是行优先前缀
                continue
            boxes = _cell_boxes(al, cols, rows, cw, ch)
            bw = np.array([b[2] - b[0] + 1 for b in boxes], float)
            bh = np.array([b[3] - b[1] + 1 for b in boxes], float)
            cv = max(bw.std() / bw.mean(), bh.std() / bh.mean())
            cands.append((cv, n, cols, rows, cw, ch))
    if not cands:
        return None
    # CV 不做绝对淘汰，只用来在候选之间比较：绝对阈值会把爆炸/死亡这类逐帧体型剧变的
    # 真序列帧一起毙掉（本语料 5 张，CV 都超 0.25），而它们只有一个候选、本来就是对的。
    lim = max(GRID_BBOX_CV, 1.5 * min(c[0] for c in cands))
    ok = [c for c in cands if c[0] <= lim]
    ok.sort(key=lambda c: (-c[1], c[0]))
    return ok[0][2:]


def trim_content(a):
    """
    裁掉透明留白。返回 (新图, 记录 dict 或 None)。任何情况下都不会切掉不透明像素。
    """
    al = a[:, :, 3] > 0
    if not al.any() or al.all():
        return a, None
    h, w = al.shape
    g = detect_grid(al)

    if g is None:
        ys, xs = np.where(al)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
        if (x0, y0, x1, y1) == (0, 0, w - 1, h - 1):
            return a, None
        return a[y0:y1 + 1, x0:x1 + 1], {
            "mode": "single", "from": f"{w}x{h}", "to": f"{x1 - x0 + 1}x{y1 - y0 + 1}",
            "offset": [x0, y0]}

    # 序列帧：并集矩形保证不丢像素，各帧裁同一个矩形保证对齐不变
    cols, rows, cw, ch = g
    x0, y0, x1, y1 = cw, ch, -1, -1
    for r in range(rows):
        for c in range(cols):
            cell = al[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            if not cell.any():
                continue
            ys, xs = np.where(cell)
            x0 = min(x0, int(xs.min())); x1 = max(x1, int(xs.max()))
            y0 = min(y0, int(ys.min())); y1 = max(y1, int(ys.max()))
    if (x0, y0, x1, y1) == (0, 0, cw - 1, ch - 1):
        return a, None
    nw, nh = x1 - x0 + 1, y1 - y0 + 1
    out = np.zeros((nh * rows, nw * cols, 4), a.dtype)
    for r in range(rows):
        for c in range(cols):
            out[r * nh:(r + 1) * nh, c * nw:(c + 1) * nw] = \
                a[r * ch + y0:r * ch + y1 + 1, c * cw + x0:c * cw + x1 + 1]
    return out, {
        "mode": "sheet", "grid": [cols, rows], "cell_from": f"{cw}x{ch}",
        "cell_to": f"{nw}x{nh}", "from": f"{w}x{h}", "to": f"{nw * cols}x{nh * rows}",
        "offset": [x0, y0]}


# ============================ 5. RGB 向透明区扩散 ============================

def bleed_rgb(a):
    """
    把不透明像素的 RGB 扩散进透明区域（最近邻填充）。

    透明像素的 RGB 若是纯白或纯黑，一旦被平滑缩放（imageSmoothingEnabled 默认 true、
    CSS 缩放、mipmap、drawImage 到非整数倍矩形）就会在轮廓外漏出一圈白边或黑边。
    语料 218 张里 141 张的透明区是纯白或纯黑，这是覆盖面最广的一条缺陷。
    """
    hole = a[:, :, 3] == 0
    if not hole.any() or hole.all():
        return a, 0
    idx = ndimage.distance_transform_edt(hole, return_distances=False, return_indices=True)
    out = a.copy()
    out[:, :, :3] = a[:, :, :3][idx[0], idx[1]]
    return out, int((out[:, :, :3] != a[:, :, :3]).any(2).sum())


# ============================ 主流程 ============================

def clean_image(path):
    """
    算法唯一入口：输入图片路径，输出 (清洗后的 RGBA 数组, 决策记录 dict)。
    不读任何旁路信息。原图不动。
    """
    src = np.array(Image.open(path).convert("RGBA"))
    a = src
    h, w = a.shape[:2]
    acts, det = [], detect_key(a)

    if det["kind"] == "chroma":
        a, frac = apply_chroma_key(a, tuple(det["key"]))
        acts.append(f"chroma 去底 key={det['key']} → 透明{frac * 100:.1f}%")
    elif det["kind"] == "alpha":
        acts.append(f"已有真 alpha（透明{det['transparent'] * 100:.0f}%），不 key")
    else:
        acts.append(f"四边中位色低饱和（sat={det['border_sat']}）→ 判为画面内容，不抠")

    a, n = normalize_alpha(a)
    if n:
        acts.append(f"整理半透明浮尘 {n}px")

    tile, why = looks_like_tile(a)
    if tile:
        a = full_bleed(a)
        acts.append(f"满幅出血（{why}）")

    a, trim = trim_content(a)
    if trim:
        if trim["mode"] == "sheet":
            acts.append(f"裁留白 {trim['from']}→{trim['to']}（{trim['grid'][0]}x{trim['grid'][1]} 帧，"
                        f"单帧 {trim['cell_from']}→{trim['cell_to']}）")
        else:
            acts.append(f"裁留白 {trim['from']}→{trim['to']}（偏移 {trim['offset']}）")

    a, n = bleed_rgb(a)
    if n:
        acts.append(f"RGB 扩散进透明区 {n}px")

    al = a[:, :, 3]
    return a, {
        "size": f"{w}x{h}",
        "size_out": f"{a.shape[1]}x{a.shape[0]}",
        "bg_kind": det["kind"],
        "detect": det,
        "trim": trim,
        "actions": acts,
        "changed": bool(a.shape != src.shape or (a != src).any()),
        "transparent_before": round(float((src[:, :, 3] == 0).mean()), 4),
        "transparent_after": round(float((al == 0).mean()), 4),
    }


def iter_assets(app_dir):
    """<app-id>/<app-id>/src/assets 下的所有图片（含子目录），跳过我自己的 .orig 备份。"""
    ad = os.path.join(app_dir, os.path.basename(app_dir), "src", "assets")
    if not os.path.isdir(ad):
        return None, []
    files = [p for p in sorted(glob.glob(os.path.join(ad, "**", "*"), recursive=True))
             if p.lower().endswith(IMG_EXT) and f"{os.sep}.orig{os.sep}" not in p]
    return ad, files


def run_batch(code_root, out_root, dry=False):
    apps = [d for d in sorted(os.listdir(code_root))
            if d.startswith("app-") and os.path.isdir(os.path.join(code_root, d))]
    summary, total, touched = [], 0, 0
    for app in apps:
        ad, files = iter_assets(os.path.join(code_root, app))
        if not files:
            print(f"\n=== {app} === 无图片素材，跳过（{'无 assets 目录' if ad is None else '目录里只有脚本'}）")
            summary.append({"app": app, "images": 0, "changed": 0, "note": "无图片素材"})
            continue
        out_dir = os.path.join(out_root, app)
        if not dry:
            os.makedirs(out_dir, exist_ok=True)
        print(f"\n=== {app} ===  {len(files)} 张")
        rep, changed = [], 0
        for p in files:
            rel = os.path.relpath(p, ad)
            arr, info = clean_image(p)
            info["file"] = rel
            rep.append(info)
            total += 1
            mark = "改" if info["changed"] else "  "
            print(f"  {mark} {rel:28} {info['size']:>10}→{info['size_out']:<10} {info['bg_kind']:10} " +
                  ("; ".join(info["actions"]) or "无需处理"))
            if info["changed"]:
                changed += 1; touched += 1
            if not dry:
                dst = os.path.join(out_dir, os.path.splitext(rel)[0] + ".png")
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                Image.fromarray(arr, "RGBA").save(dst)
        if not dry:
            with open(os.path.join(out_dir, "_report.json"), "w") as f:
                json.dump(rep, f, ensure_ascii=False, indent=2)
        summary.append({"app": app, "images": len(files), "changed": changed})
    print(f"\n=== 汇总 ===  {len(apps)} 个包 / {total} 张图 / 修改 {touched} 张")
    for s in summary:
        print(f"  {s['app']:20} 图 {s['images']:3d}  改 {s.get('changed', 0):3d}  {s.get('note', '')}")
    return summary


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    if args[0] == "--batch":
        rest = [x for x in args[1:] if x != "--dry"]
        run_batch(rest[0] if rest else DEFAULT_CODE_ROOT, DEFAULT_OUT_ROOT,
                  dry="--dry" in args)
    else:
        path = args[0]
        out = args[args.index("-o") + 1] if "-o" in args else None
        arr, info = clean_image(path)
        print(json.dumps(info, ensure_ascii=False, indent=2))
        if out:
            Image.fromarray(arr, "RGBA").save(out)
            print(f"写出 {out}")


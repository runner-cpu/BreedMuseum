#!/usr/bin/env python3
"""
就地修复像素素材包的像素缺陷，原图备份到 <assets>/.orig/。

两个核心操作：
  white_key(name)     白底 → 真 alpha。从画布四边洪泛，只吃与边缘连通的近白像素，
                      所以角色/道具内部的白色高光（如蘑菇白点、旗杆球头）不会被误抠。
  bleed_to_tile(name) 去透明边距 → 满幅出血。裁掉内容框外的透明边，NEAREST 放回
                      32x32 并把 alpha 全部拉到 255，连排平铺才不会露缝。

另外两个针对本 case 的操作：recolor_question()（问号砖对比度≈0 的配色重做）、
fix_bg_far()/fix_bg_mid()（裁掉远景内置地面带、把两层裁到「下边缘=地平线」）。

用法:  python3 fix_assets.py [素材目录]
       默认目录 = app-e18ymz3hyvb5 的 src/assets
依赖:  pillow numpy
"""
import os, sys, shutil
from collections import deque
import numpy as np
from PIL import Image

DEFAULT_ROOT = "/Users/chengxuyi/Downloads/资产库需求/data/code/0920-game-asset-d24/app-e18ymz3hyvb5/app-e18ymz3hyvb5/src/assets"
ROOT = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ROOT
ORIG = os.path.join(ROOT, ".orig")
os.makedirs(ORIG, exist_ok=True)

def load(name):
    p = os.path.join(ROOT, name)
    b = os.path.join(ORIG, name)
    if not os.path.exists(b):
        shutil.copy2(p, b)
    return np.array(Image.open(b).convert("RGBA"))

def save(name, arr):
    Image.fromarray(arr, "RGBA").save(os.path.join(ROOT, name))
    print(f"  写出 {name}  {arr.shape[1]}x{arr.shape[0]}")

def bbox(a, thr=8):
    m = a[:, :, 3] > thr
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max(), ys.max()


# ---------- 1. 白底抠像：从边界洪泛，只吃与画布边缘连通的近白像素 ----------
def white_key(name, thr=225):
    a = load(name).copy()
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(int)
    whiteish = rgb.min(axis=2) >= thr
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if whiteish[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if whiteish[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and whiteish[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    # 再吃一圈紧贴透明区的白色羽化边
    for _ in range(2):
        nb = np.zeros((h, w), bool)
        nb[1:, :] |= seen[:-1, :]; nb[:-1, :] |= seen[1:, :]
        nb[:, 1:] |= seen[:, :-1]; nb[:, :-1] |= seen[:, 1:]
        seen |= nb & (rgb.min(axis=2) >= 200)
    a[seen, 3] = 0
    print(f"{name}: 抠掉 {seen.mean()*100:.1f}% 的白底像素")
    save(name, a)
    return a


# ---------- 2. 砖块满幅出血 + 问号砖配色 ----------
def bleed_to_tile(name, size=32):
    a = load(name)
    x0, y0, x1, y1 = bbox(a)
    crop = a[y0:y1 + 1, x0:x1 + 1]
    out = np.array(Image.fromarray(crop, "RGBA").resize((size, size), Image.NEAREST))
    out[:, :, 3] = 255                      # 满幅不透明，消除相邻砖块之间的缝
    print(f"{name}: 内容框 {x1-x0+1}x{y1-y0+1} -> 满幅 {size}x{size}，透明像素 0%")
    return out


def recolor_question(a):
    """奶白底 + 白问号（对比度≈0）→ 饱和黄底 + 深棕问号"""
    rgb = a[:, :, :3].astype(int)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx, mn = rgb.max(2), rgb.min(2)
    near_white = mn >= 235                       # 问号笔画
    grayish = (mx - mn < 42) & ~near_white       # 边框/暗部
    yellowish = (r > 190) & (g > 165) & (b < 210) & ~near_white & ~grayish
    out = a.copy()
    out[near_white, :3] = (86, 44, 8)            # 深棕问号
    out[grayish, :3] = (198, 108, 8)             # 橙棕描边/暗部
    # 底色按明度分两档，保留原有的轻微体积感
    lum = (0.299 * r + 0.587 * g + 0.114 * b)
    hi = yellowish & (lum >= 225)
    lo = yellowish & (lum < 225)
    out[hi, :3] = (252, 204, 56)
    out[lo, :3] = (248, 184, 0)
    print(f"  问号砖配色: 问号 {near_white.mean()*100:.1f}% / 描边 {grayish.mean()*100:.1f}% / 底色 {yellowish.mean()*100:.1f}%")
    return out


def kill_near_white(a, thr=235):
    """
    满幅出血后残留的近白像素会在连排砖块的接缝上看成一串亮点，必须替换掉。

    替换源的选法有两个坑：
      1) 不能无脑取 y+1 —— 在最后一行 y=31 上 min(y+1,31) 会读回自己，
         第一版就因此只修好 4 个角里的 2 个；
      2) 不能优先取斜向朝内的邻居 —— 砖块的边框环是深色砖缝、往里一格就是亮
         砖面，取斜向会把角点刷成 (176,111,74) 这种亮色，等于亮点没消掉只是变暗了。
    所以优先沿着同一条边框移动（先纵后横），拿到的是砖缝色；实在没有干净邻居
    才退到斜向和四邻。单趟也不够：角点的邻居本身可能也是近白的，要扫到收敛。

    阈值取 min(rgb)>=235 而不是 240：本包右下角残留是 (248,244,239)，min=239，
    用 240 会漏掉它。
    """
    out = a.copy()
    h, w = a.shape[:2]
    for _ in range(8):
        bad = out[:, :, :3].min(axis=2) >= thr
        if not bad.any():
            break
        for y, x in zip(*np.where(bad)):
            dy = 1 if y == 0 else (-1 if y == h - 1 else 0)
            dx = 1 if x == 0 else (-1 if x == w - 1 else 0)
            for ny, nx in ((y + dy, x), (y, x + dx), (y + dy, x + dx),
                           (y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and (ny, nx) != (y, x) and not bad[ny, nx]:
                    out[y, x, :3] = out[ny, nx, :3]
                    break
    left = int((out[:, :, :3].min(axis=2) >= thr).sum())
    print(f"  近白残留: 清理后剩 {left} 个像素")
    return out


# ---------- 3. 背景层：切掉 bg_far 内置地面、裁掉两层多余的透明行 ----------
def fix_bg_far(keep_rows=512):
    a = load("bg_far.png")
    flat = np.array([112, 159, 122])
    first = None
    for y in range(a.shape[0]):
        row = a[y, :, :3].astype(int)
        first = y if (np.abs(row - flat).max() <= 6 and first is None) else (first if np.abs(row - flat).max() <= 6 else None)
    print(f"bg_far: 内置纯色地面带 {first}-{a.shape[0]-1}（{a.shape[0]-first} 行）已裁除")
    out = a[:keep_rows].copy()
    out[:, :, 3] = 255
    save("bg_far.png", out)
    return out


def fix_bg_mid(bottom=544):
    a = load("bg_mid.png")
    _, y0, _, y1 = bbox(a)
    print(f"bg_mid: 内容行 {y0}-{y1}，裁成 [{y0}, {bottom}) 使图片下边缘 = 地平线")
    return a[y0:bottom].copy()


if __name__ == "__main__":
    print(f"素材目录: {ROOT}\n备份目录: {ORIG}\n")

    print("=== 白底 → 真 alpha ===")
    pipe = white_key("pipe.png")
    pole = white_key("flagpole.png")

    print("\n=== 砖块满幅出血 ===")
    save("brick_normal.png", kill_near_white(bleed_to_tile("brick_normal.png")))
    save("brick_question.png", kill_near_white(recolor_question(bleed_to_tile("brick_question.png"))))

    print("\n=== 背景层 ===")
    fix_bg_far()
    save("bg_mid.png", fix_bg_mid())

    print("\n=== 九宫格切片测量（用于 canvasRenderer 常量）===")
    for name in ("pipe.png", "flagpole.png"):
        a = np.array(Image.open(os.path.join(ROOT, name)).convert("RGBA"))
        al = a[:, :, 3] > 8
        widths = al.sum(1)
        rows = np.where(widths > 0)[0]
        print(f"{name}: {a.shape[1]}x{a.shape[0]} 内容行 {rows[0]}-{rows[-1]}")
        prev = None
        for y in rows:
            xs = np.where(al[y])[0]
            seg = (xs.min(), xs.max(), widths[y])
            if seg != prev:
                print(f"    y={y:3d} x={seg[0]:2d}-{seg[1]:2d} 宽{seg[2]:2d}")
                prev = seg

    print("\n=== 校验 ===")
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".png"):
            continue
        a = np.array(Image.open(os.path.join(ROOT, name)).convert("RGBA"))
        al = a[:, :, 3]
        rgb = a[:, :, :3].astype(int)
        nw = ((rgb.min(2) >= 240) & (al == 255)).mean()
        print(f"  {name:24} {a.shape[1]:5d}x{a.shape[0]:<5d} 透明{(al==0).mean()*100:5.1f}%  不透明近白{nw*100:5.1f}%")

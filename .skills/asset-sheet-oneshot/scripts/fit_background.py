#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把一张整幅背板收成游戏真正要用的尺寸：按目标比例居中裁切 → 缩放 → 压平 alpha → 测底部留白。

用法:
  python3 fit_background.py <in.png> --out <out.png> --target 1280x720 [--style pixel|hd]

为什么需要这一步：网关只有 `2848x1152` 那一档尺寸被可靠遵守（`1024x1024` 实测 89 张
里只有 12 张符合），所以背板出图时**不要指望拿到你要的比例**，出完在本地裁到位。
背板是纯装饰、上面没有任何要算坐标的东西（那是 Gate 3 禁掉的），所以居中裁切安全。

`--style pixel` 用 NEAREST（像素风缩放绝不能插值），`hd` 用 LANCZOS。
带 alpha 的输入会被压平成不透明：背板是最底层，透明处会漏出画布底色。
压平面积超过 2% 时告警 —— 那说明这张图不是整幅背板，别拿它当底板用。

**底部留白检测**：prompt 里常让模型「下部留一条浅色空白给代码画地面」，这片留白就是
Coding Agent 应该画地面/地砖的起点。它自己看不出这张图哪一行开始变纯色，所以这里在
裁剪缩放**之后**（像素坐标就是游戏里用的坐标，不用再换算比例）把 `blankBottomY`
（留白区域顶部的 y）和 `blankBottomHeight`（留白区域高度）算出来。

**两条来源，prompt 意图优先**：
1. 传了 `--prompt-file` 且里面写了「下部/底部 + 三分之一 / 1/3 / 底部N% + 留白/留空」
   这类明确诉求时，直接按这个比例算（`blankBottomHeight = 画布高 × 比例`），
   `blankBottomSource="prompt"`。这是权威意图——「下部三分之一留白」这句话本来就是
   规划人写死的约定，比去猜像素靠谱。实测里像素扫描对轻纹理地面经常整段扫不出（返回
   null），把明明白白写在 prompt 里的意图丢掉，所以 prompt 分数排在前面。
2. 没有 prompt 分数时，退回逐行颜色方差扫描：从底部往上找连续纯色/近纯色带的起点，
   `blankBottomSource="scan"`。
两条都拿不到就 `blankBottomY: null`（`blankBottomSource: null`）。

结果随 stdout 一起吐出去，run_pipeline.py 原样塞进 `pipeline.json`，manifest 里的
background 条目也应该带上这两个字段。

stdout: {"out":..., "src_size":..., "cropped":..., "out_size":..., "flattened":...,
         "blankBottomY":..., "blankBottomHeight":..., "blankBottomSource":...}
"""
import argparse, io, json, os, re, sys

from PIL import Image

# 逐行颜色方差扫描：一行里等间距抽样几个点，算 R/G/B 各自的 max-min 再相加，
# 低于这个阈值就认为这一行近似纯色（留白/天空平坦区都满足，但天空有云缕通常扫不到底部）。
ROW_SPREAD_THRESH = 20
# 从底部往上扫的采样步长（列方向），2848/1280 这类尺寸下够密也够快。
SAMPLE_STEP = 8
# 留白带至少要有这么高才值得报告，防止最后几像素压缩噪声被误判成留白。
MIN_BLANK_PX = 8

# 「下部」方位词、留白词：只有三者（方位 + 分数 + 留白）同现才认，避免误触发。
_POS_WORDS = ('下部', '底部', '下方', '画面下', '下缘', '底端', 'bottom', 'lower')
_BLANK_WORDS = ('留白', '留空', '空白', '浅色带', '浅色空白', '空出', '留一条', '留出',
                'blank', 'reserve', 'empty')
# 中文数字 → int（够用即可，分母一般 2~10）
_CN_NUM = {'一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
           '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}


def parse_blank_fraction(text):
    """从 bg prompt 里解析「底部留白占画布高的比例」。解析不出返回 None。

    只有同时命中「下部方位词 + 分数写法 + 留白词」才返回，避免把普通描述误当留白诉求。
    支持的分数写法：三分之一 / 1/3 / 底部30% / 底部 0.3。返回 (0,1) 内的浮点。
    """
    if not text:
        return None
    low = text.lower()
    if not any(w in text or w in low for w in _POS_WORDS):
        return None
    if not any(w in text or w in low for w in _BLANK_WORDS):
        return None

    f = None
    # 中文「X分之Y」（如 三分之一 = 1/3）
    m = re.search(r'([一二两三四五六七八九十])\s*分之\s*([一二两三四五六七八九十])', text)
    if m:
        den = _CN_NUM.get(m.group(1)); num = _CN_NUM.get(m.group(2))
        if den:
            f = (num or 1) / float(den)
    # 阿拉伯「M/N」（如 1/3）
    if f is None:
        m = re.search(r'(\d+)\s*/\s*(\d+)', text)
        if m and int(m.group(2)):
            f = int(m.group(1)) / float(m.group(2))
    # 百分比（底部 30% / 30 %）
    if f is None:
        m = re.search(r'(\d+(?:\.\d+)?)\s*%', text)
        if m:
            f = float(m.group(1)) / 100.0
    if f is None or not (0.0 < f < 1.0):
        return None
    return f



def parse_size(s):
    w, _, h = s.lower().partition('x')
    return int(w), int(h)


def row_spread(px, y, w, step=SAMPLE_STEP):
    row = [px[x, y] for x in range(0, w, step)]
    rs = [c[0] for c in row]; gs = [c[1] for c in row]; bs = [c[2] for c in row]
    return (max(rs) - min(rs)) + (max(gs) - min(gs)) + (max(bs) - min(bs))


def detect_blank_bottom(im):
    """从底部往上扫，找连续纯色带的顶部 y。测不出就返回 (None, None)。

    只认从最后一行开始**连续不间断**的纯色带 —— 天空里偶尔一两行方差也很低（大片同色云），
    中断一次就说明不是真的「下部留白」，不能把上面误判进来。
    """
    w, h = im.size
    px = im.load()
    y = h - 1
    while y >= 0 and row_spread(px, y, w) <= ROW_SPREAD_THRESH:
        y -= 1
    top = y + 1                      # 留白带第一行
    blank_h = h - top
    if blank_h < MIN_BLANK_PX:
        return None, None
    return top, blank_h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', required=True)
    ap.add_argument('--target', default='1280x720')
    ap.add_argument('--style', default='pixel', choices=('pixel', 'hd'))
    ap.add_argument('--prompt-file', dest='prompt_file',
                    help='bg prompt 文件；写了「下部三分之一留白」这类诉求时优先按它算留白')
    a = ap.parse_args()

    tw, th = parse_size(a.target)
    im = Image.open(a.src)
    src_size = im.size

    # alpha 压平：背板必须不透明
    flat = 0.0
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        alpha = im.getchannel('A')
        hist = alpha.histogram()
        flat = sum(hist[:250]) / float(im.width * im.height)
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    im = im.convert('RGB')

    # 按目标比例居中裁切
    want = tw / float(th)
    have = im.width / float(im.height)
    if abs(have - want) > 1e-3:
        if have > want:                      # 太宽，裁左右
            w = int(round(im.height * want))
            x = (im.width - w) // 2
            box = (x, 0, x + w, im.height)
        else:                                # 太高，裁上下
            h = int(round(im.width / want))
            y = (im.height - h) // 2
            box = (0, y, im.width, y + h)
        im = im.crop(box)
    else:
        box = (0, 0, im.width, im.height)

    resample = Image.NEAREST if a.style == 'pixel' else Image.LANCZOS
    if im.size != (tw, th):
        im = im.resize((tw, th), resample)

    # 留白：prompt 意图优先，像素扫描兜底。测出来的 y 就是游戏里画布坐标，不用再换算比例。
    blank_y = blank_h = None
    blank_src = None
    frac = None
    if a.prompt_file and os.path.isfile(a.prompt_file):
        with io.open(a.prompt_file, encoding='utf-8') as f:
            frac = parse_blank_fraction(f.read())
    if frac is not None:
        blank_h = int(round(th * frac))
        blank_y = th - blank_h
        blank_src = 'prompt'
    else:
        blank_y, blank_h = detect_blank_bottom(im)
        blank_src = 'scan' if blank_y is not None else None

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    im.save(a.out)
    # blankBottomY 是「背板原生高度 th」帧里的像素值。Coding Agent 常把背板缩放到别的
    # 高度上屏（把 720 压到 540），裸用绝对值会错位（实测地面比背景留白低约 120px）。
    # 所以额外给一个帧无关的比例 blankBottomYRatio = blankBottomY / th，让下游能算
    # 「地面y = round(ratio × 实际上屏高度)」，并带上参照高度 blankBottomRefHeight=th。
    blank_ratio = round(blank_y / float(th), 4) if blank_y is not None else None
    print(json.dumps({'out': a.out, 'src_size': list(src_size),
                      'cropped': list(box), 'out_size': [tw, th],
                      'flattened': round(flat, 4),
                      'blankBottomY': blank_y, 'blankBottomHeight': blank_h,
                      'blankBottomYRatio': blank_ratio, 'blankBottomRefHeight': th,
                      'blankBottomSource': blank_src},
                     ensure_ascii=False))
    if flat > 0.02:
        print('输入有 %.1f%% 的像素是透明的，已压成白色 —— 整幅背板不该有透明区，'
              '确认这张图真的是背板' % (flat * 100), file=sys.stderr)
    if blank_y is not None:
        print('底部留白：y=%d 起，高 %d px（画布高 %d，来源=%s）。这就是代码该画地面的'
              '起始行/角色脚底基准线，写进 manifest 的 blankBottomY/blankBottomHeight'
              % (blank_y, blank_h, th, blank_src), file=sys.stderr)


if __name__ == '__main__':
    main()


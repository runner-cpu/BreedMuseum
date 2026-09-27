#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把背板改成可无缝水平循环平铺的版本：左右对半切、互换拼接、调 image-edits 美化接缝。

用法:
  python3 seam_background.py <in.png> --out <out.png> \
      [--raw-out <bg_seam_raw.png>] [--size 1536x1024] \
      [--skill-script /path/to/image-generation-super/scripts/generate_image.py]

为什么要做这一步：横版游戏的背景图会水平循环轮播（同一张图左右首尾相接、无限滚动），
如果背板本身不是「无缝可循环」的，循环点（图右边缘接下一张的左边缘）会有明显割裂感。

做法：设原图为 [A][B]（A=左半，B=右半）。水平循环平铺时真正的接缝在
「B 的右边缘 接 下一张 A 的左边缘」，也就是本图的 B-右边 和 A-左边。
把图按 [B][A] 顺序重新拼接后，这条缝正好落在新图的正中间——
一次 image-edits 局部重绘就能把这一条缝抹平，不用同时处理原图两端两条缝。

**美化后不换回 [A][B] 顺序，直接把 [B][A] 当成最终背板**（已与用户确认）：
拼接互换只是改变了画面内容从哪里"接起来"，图本身依然是完整的一张背景，
再切一次只会多引入一次可能出错的操作。

只处理左右接缝（水平循环），不处理上下（游戏背景通常不会垂直循环滚动）。

美缝后把结果缩回 src 尺寸：editImage 只有固定几档尺寸，返回的图往往不是 src 的分辨率
（实测把 1280x720 改成过 1672x941）。美缝只该抹接缝、不该改分辨率，所以拿到结果后按
`--style`（pixel=NEAREST / hd=LANCZOS）缩回 src 尺寸，别让档位尺寸污染交付和 manifest。

失败回退：image-edits 被内容安全拦截或请求异常时，回退到**未拼接的原背板**
（也就是本脚本的输入 src，等于这一步整个没跑）——不交付「拼接但接缝生硬」的中间态，
拼接是为了让接缝更好看，拼不好就不如不拼，保留原图至少画面本身是完整可信的。

stdout: {"file":..., "raw_file":..., "seam_ok":..., "seam_blocked":..., "resized_to":..., "backend":...}
退出码: 0 成功（美化或回退都算 0，因为回退图仍然是可用产物）；1 硬失败（连拼接都做不出来）。
"""
import argparse, io, json, os, subprocess, sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

SEAM_PROMPT = (
    'This image is a horizontally-scrolling game background formed by cutting the '
    'original image in half and swapping the two halves, so a hard vertical seam now '
    'runs down the middle of the frame where the original right edge meets the '
    'original left edge. Repaint ONLY a narrow vertical band around this centre seam '
    'so the sky, ground line, colors, lighting and any repeating patterns flow '
    'continuously across it with no visible break — the seam must become invisible. '
    'Everything outside that narrow band must stay byte-for-byte identical: do not '
    'repaint, move or redraw it. '
    # 约束一：禁止全局色差。editImage 常见毛病是把整图重新调色/曝光/白平衡，
    # 导致美化后的图和相邻素材、和循环平铺的另一份自己产生整体色调偏移。
    'CRITICAL — no global color shift: keep the exact same colors, brightness, '
    'contrast, saturation and white balance as the input across the ENTIRE image. '
    'Do not re-expose, re-grade, warm up, cool down or tint the picture. The '
    'repainted seam band must colour-match its immediate neighbours pixel-for-pixel '
    'so there is zero tonal difference between the edited band and the untouched '
    'areas. '
    # 约束二：底部预留留白高度必须不变。editImage 会把地平线/远景往下拉，
    # 挤压或抬高底部那条留给代码画地面的纯色空白带，导致留白比例变大。
    'CRITICAL — preserve the bottom reserved area: the flat, near-solid empty band '
    'along the bottom of the frame (reserved for the game to draw its ground) must '
    'keep EXACTLY the same height and the same top edge position as in the input. '
    'Do NOT enlarge, shrink, raise or lower it, and do NOT move the horizon or the '
    'scenery/ground boundary line up or down — that boundary stays on the exact same '
    'row. '
    'Keep the same style, composition, palette and content on both sides. '
    'Do not add new objects or text.'
)


def swap_halves(im):
    """从正中间垂直切成左右两半，按 B+A 顺序重新拼接成同尺寸新图。

    宽度为奇数时右半（B）多分到 1px，左右对齐直接拼接，不做特殊处理——
    1px 的宽度差在背景图上不影响观感。
    """
    w, h = im.size
    mid = w // 2
    a_part = im.crop((0, 0, mid, h))       # 左半 A
    b_part = im.crop((mid, 0, w, h))       # 右半 B
    out = Image.new(im.mode, (w, h))
    out.paste(b_part, (0, 0))              # B 放左边
    out.paste(a_part, (b_part.width, 0))   # A 放右边
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', help='fit_background.py 产出的最终尺寸背板图')
    ap.add_argument('--out', required=True, help='美化成功后的最终背板')
    ap.add_argument('--raw-out', help='拼接但未美化的中间图，默认和 --out 同目录 _raw 后缀')
    ap.add_argument('--size', help='image-edits 请求尺寸，默认按 src 宽高比自动挑最接近的受支持档位')
    ap.add_argument('--style', default='pixel', choices=('pixel', 'hd'),
                    help='美缝后把结果缩回 src 尺寸时的重采样：pixel=NEAREST, hd=LANCZOS')
    ap.add_argument('--log', help='把 image-edits 的原始返回存一份')
    ap.add_argument('--skill-script',
                    help='image-generation-super 的 generate_image.py；'
                         '不传则按 IMAGE_GEN_SUPER_SCRIPT / 约定位置解析（同 generate_sheet.py）')
    ap.add_argument('--direct', action='store_true', help='跳过 image-generation-super，用内置直连')
    a = ap.parse_args()

    im = Image.open(a.src).convert('RGB')
    raw_out = a.raw_out or (os.path.splitext(a.out)[0] + '_raw.png')
    os.makedirs(os.path.dirname(os.path.abspath(raw_out)), exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)

    seam = swap_halves(im)
    seam.save(raw_out)

    # image-edits 走的四档尺寸和 sheet 出图一致，按 src 宽高比选最接近的一档
    size = a.size
    if not size:
        SIZES = ('1024x1024', '1536x1024', '1024x1536', '2848x1152')
        def parse(s):
            wp, _, hp = s.partition('x')
            return int(wp), int(hp)
        want = im.width / float(im.height)
        size = min(SIZES, key=lambda s: abs(parse(s)[0] / float(parse(s)[1]) - want))

    prompt_file = os.path.splitext(a.out)[0] + '_prompt.txt'
    with io.open(prompt_file, 'w', encoding='utf-8') as f:
        f.write(SEAM_PROMPT)

    argv = [sys.executable, os.path.join(HERE, 'generate_sheet.py'),
            '--prompt', prompt_file, '--out', a.out, '--size', size,
            '--images', raw_out]
    if a.log:
        argv += ['--log', a.log]
    if a.skill_script:
        argv += ['--skill-script', a.skill_script]
    if a.direct:
        argv += ['--direct']

    p = subprocess.run(argv, capture_output=True, text=True)
    if p.stderr:
        print(p.stderr.strip(), file=sys.stderr)

    result = {'raw_file': raw_out, 'size': size}
    if p.returncode == 0:
        try:
            d = json.loads((p.stdout or '').strip().splitlines()[-1])
        except Exception:
            d = {}
        # editImage 只有固定几档尺寸，返回的往往不是 src 的尺寸（观测到 1280x720
        # 目标被改成 1536x1024 / 1672x941）。美缝只是抹接缝，不该改分辨率——把结果
        # 缩回 src（也就是 fit_background 的目标）尺寸，别让档位尺寸污染交付和 manifest。
        resized_to = None
        try:
            edited = Image.open(a.out).convert('RGB')
            if edited.size != im.size:
                resample = Image.NEAREST if a.style == 'pixel' else Image.LANCZOS
                edited.resize(im.size, resample).save(a.out)
                resized_to = list(im.size)
        except Exception as e:                       # noqa: BLE001
            print('美缝后缩回目标尺寸失败（不影响已写出的图）：%s' % e, file=sys.stderr)
        result.update({'file': a.out, 'seam_ok': True, 'seam_blocked': False,
                       'backend': d.get('backend'), 'resized_to': resized_to,
                       'revised_prompt': d.get('revised_prompt', '')})
    else:
        # 失败（被拦截或异常）：回退用未拼接的原背板，等于这一步没跑过。
        # --out 常常和 src 是同一个文件（run_pipeline.py 就地替换 dst），
        # 这种情况下"回退"什么都不用做，src 本来就还是原样
        import shutil
        if os.path.abspath(a.src) != os.path.abspath(a.out):
            shutil.copy2(a.src, a.out)
        result.update({'file': a.out, 'seam_ok': False,
                       'seam_blocked': p.returncode == 3, 'backend': None})
        print('接缝美化失败（exit=%d），回退用未拼接的原背板：%s'
              % (p.returncode, a.out), file=sys.stderr)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()

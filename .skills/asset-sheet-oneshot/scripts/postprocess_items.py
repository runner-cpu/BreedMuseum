#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""切片的后处理：chroma 去底 → 裁最小外接矩形 → RGB 扩散（→ 可选降采样）。

用法:
  python3 postprocess_items.py <items_dir> --out <clean_dir> [--max-side 128]
                              [--report clean_report.json]

算法全部来自 clean_asset.clean_image（原样复用，不改阈值）：
  detect_key → apply_chroma_key → normalize_alpha
  → looks_like_tile/full_bleed → trim_content → bleed_rgb

--max-side 用 NEAREST 等比缩到指定长边。sheet 切出来的素材是 172~667px，
而线上 meowa 同名素材是 6~124px，直接入库会大 4~10 倍，像素风还会因为
双线性插值糊掉，所以缩放必须用 NEAREST。
"""
import argparse, io, json, os, sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean_asset import clean_image  # noqa: E402

EXT = ('.png', '.webp', '.jpg', '.jpeg')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('items_dir')
    ap.add_argument('--out', required=True)
    ap.add_argument('--max-side', type=int, help='等比 NEAREST 缩到这个长边')
    ap.add_argument('--report')
    a = ap.parse_args()

    files = sorted(f for f in os.listdir(a.items_dir) if f.lower().endswith(EXT))
    if not files:
        print('%s 下没有图片' % a.items_dir, file=sys.stderr)
        sys.exit(1)
    os.makedirs(a.out, exist_ok=True)

    rows, fails = [], 0
    for f in files:
        src = os.path.join(a.items_dir, f)
        try:
            arr, info = clean_image(src)
        except Exception as e:
            fails += 1
            rows.append({'file': f, 'error': str(e)})
            print('后处理失败 %s: %s' % (f, e), file=sys.stderr)
            continue
        img = Image.fromarray(arr)  # arr 已是 RGBA，不传 mode（Pillow 13 会移除该参数）
        if a.max_side and max(img.size) > a.max_side:
            s = a.max_side / float(max(img.size))
            img = img.resize((max(1, int(round(img.width * s))),
                             max(1, int(round(img.height * s)))), Image.NEAREST)
        dst = os.path.splitext(f)[0] + '.png'
        img.save(os.path.join(a.out, dst))
        rows.append({'file': dst, 'size_in': info['size'],
                     'size_trimmed': info['size_out'],
                     'size_out': '%dx%d' % img.size,
                     'bg_kind': info['bg_kind'],
                     'alpha': round(float((np.asarray(img)[:, :, 3] == 0).mean()), 4),
                     'actions': info['actions']})

    ok = [r for r in rows if 'error' not in r]
    keyed = [r for r in ok if r['bg_kind'] == 'chroma']
    rep = {'items_dir': a.items_dir, 'out': a.out, 'max_side': a.max_side,
           'total': len(rows), 'ok': len(ok), 'failed': fails,
           'bg_keyed': len(keyed), 'items': rows}
    if a.report:
        os.makedirs(os.path.dirname(os.path.abspath(a.report)), exist_ok=True)
        with io.open(a.report, 'w', encoding='utf-8') as fp:
            fp.write(json.dumps(rep, ensure_ascii=False, indent=2))
    print(json.dumps({k: rep[k] for k in ('total', 'ok', 'failed', 'bg_keyed')},
                     ensure_ascii=False))
    if fails:
        sys.exit(1)
    if len(keyed) < len(ok):
        # 没被判成 chroma 的，通常是切片垫的 key 色边框不够（clean_asset 从四边中位色反推
        # key 色，边框被内容吃掉就反推不出高饱和色），或者素材本身已带真 alpha
        print('%d/%d 未 chroma 去底，见 report 的 bg_kind/detect' % (len(ok) - len(keyed), len(ok)),
              file=sys.stderr)


if __name__ == '__main__':
    main()

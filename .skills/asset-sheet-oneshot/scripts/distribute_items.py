#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把后处理好的切片按素材名分发成逐素材目录：<dest>/<key>/<key>.png。

用法:
  python3 distribute_items.py <clean_dir> --dest <work_dir> [--plan <asset-plan.json>]

`<clean_dir>` 是 postprocess_items.py 的输出（文件名形如 `03_hero_idle.png`）。
下游 `build_manifest.py` 按 `<work_dir>/<key>/<key>.png` 找文件，这一步只做改名和拷贝。

带 `--plan` 时拿规划里的 key 对账：sheet 里没出的 key 打进 missing，
文件里多出来的 key 打进 extra，两者都只告警（退出码 2），不改动任何文件。

`unmatched_*` 是 slice_sheet 判定「这一行命名不可靠」时给的名字，**直接跳过不发布** ——
错位命名会一路带到 manifest，比少几个素材危险得多。

stdout: {"dest":..., "copied":[...], "skipped":[...], "missing":[...], "extra":[...]}
"""
import argparse, io, json, os, shutil, sys


def key_of(fname):
    """03_hero_idle.png → hero_idle。没有 NN_ 前缀就用整个文件名。"""
    stem = os.path.splitext(os.path.basename(fname))[0]
    head, _, rest = stem.partition('_')
    return rest if rest and head.isdigit() else stem


def plan_assets(plan):
    """规划里的素材列表。分组的 groups[].assets[] 和平铺的 assets[] 都收。"""
    plan = plan or {}
    out = [it for g in plan.get('groups') or [] for it in g.get('assets') or []]
    return out or list(plan.get('assets') or [])


def plan_keys(path, drop=('background', 'layer')):
    with io.open(path, encoding='utf-8') as f:
        plan = json.load(f)
    return [a['key'] for a in plan_assets(plan)
            if a.get('key') and a.get('role') not in drop]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clean_dir')
    ap.add_argument('--dest', required=True, help='工作目录，逐素材子目录建在这里')
    ap.add_argument('--plan', help='asset-plan.json，用来对账 key')
    a = ap.parse_args()

    files = sorted(f for f in os.listdir(a.clean_dir) if f.lower().endswith('.png'))
    if not files:
        print('%s 里没有 PNG' % a.clean_dir, file=sys.stderr)
        sys.exit(1)

    copied, skipped = [], []
    for f in files:
        k = key_of(f)
        if k.startswith('unmatched'):
            # slice_sheet 判定这一行的命名不可靠。宁可不发布，也不能把 A 的图挂上 B 的名字
            skipped.append(f)
            continue
        d = os.path.join(a.dest, k)
        os.makedirs(d, exist_ok=True)
        shutil.copy2(os.path.join(a.clean_dir, f), os.path.join(d, '%s.png' % k))
        copied.append(k)

    missing, extra = [], []
    if a.plan:
        want = plan_keys(a.plan)
        got = set(copied)
        missing = [k for k in want if k not in got]
        extra = [k for k in copied if k not in set(want)]

    print(json.dumps({'dest': a.dest, 'copied': copied, 'skipped': skipped,
                      'missing': missing, 'extra': extra}, ensure_ascii=False))
    if skipped:
        print('%d 张切片命名不可靠（unmatched_*），已跳过不发布' % len(skipped),
              file=sys.stderr)
    if missing or extra:
        print('切片与规划的 key 对不上：missing=%s extra=%s —— '
              '按切片在 sheet 上的阅读顺序人工核对文件名后重跑' % (missing, extra),
              file=sys.stderr)
        sys.exit(2)



if __name__ == '__main__':
    main()

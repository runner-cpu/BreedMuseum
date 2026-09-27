#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""asset-plan.json → items.json（喂给 build_sheet_prompt.py 的清单）。

用法:
  python3 plan_to_items.py <asset-plan.json> --out <items.json>
      [--exclude-roles background,layer] [--size 2848x1152] [--limit 18]

只收单体素材：`role` 在 --exclude-roles 里的（默认整幅背板和滚动层）全部剔掉 ——
背板要单独走一次 image-generation-super，塞进网格没有意义。

字段映射（规划 → sheet 清单）:
  art_style      → style     pixel / hd
  theme          → theme
  assets[].key   → name
  assets[].prompt→ desc      画图模型真正读的那段
  assets[].base_key → base   变体互指，build_sheet_prompt 会改写成「与第 N 项同一个对象」

退出码 0 正常；stdout 打印 {"out":..., "count":..., "skipped":[...]}。
"""
import argparse, io, json, os, sys


def plan_assets(plan):
    """规划里的素材列表。两种写法都收：分组的 groups[].assets[]，和平铺的 assets[]。

    规划是模型写的，分组只是给人看的组织方式，管线不依赖它。只认一种写法的话，
    模型写平铺就会被判成"零个素材"，白白烧掉一轮。
    """
    plan = plan or {}
    out = [it for g in plan.get('groups') or [] for it in g.get('assets') or []]
    return out or list(plan.get('assets') or [])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan')
    ap.add_argument('--out', required=True)
    ap.add_argument('--exclude-roles', default='background,layer')
    ap.add_argument('--size', default='2848x1152')
    ap.add_argument('--limit', type=int, default=18,
                    help='超过这个数只告警，不截断（截断会让规划和产物对不上）')
    a = ap.parse_args()

    with io.open(a.plan, encoding='utf-8') as f:
        plan = json.load(f)
    drop = {r.strip() for r in a.exclude_roles.split(',') if r.strip()}

    items, skipped, seen = [], [], set()
    for it in plan_assets(plan):
        key, role = it.get('key'), it.get('role')
        if not key:
            continue
        if role in drop:
            skipped.append({'key': key, 'role': role})
            continue
        if key in seen:
            skipped.append({'key': key, 'role': role, 'why': 'duplicate'})
            continue
        seen.add(key)
        desc = (it.get('prompt') or it.get('description') or '').strip()
        if not desc:
            print('%s 既没有 prompt 也没有 description，无法出图' % key, file=sys.stderr)
            sys.exit(1)
        one = {'name': key, 'desc': desc}
        if it.get('base_key'):
            one['base'] = it['base_key']
        items.append(one)

    if not items:
        n = len(plan_assets(plan))
        print('规划里没有可进 sheet 的素材：读到 %d 条素材%s' %
              (n, '，全被 --exclude-roles(%s) 剔掉了' % a.exclude_roles if n else
               '。检查 asset-plan.json 顶层有没有 groups[].assets[] 或 assets[]，'
               '以及每条有没有 key'), file=sys.stderr)
        sys.exit(1)
    if len(items) > a.limit:
        print('sheet 里有 %d 个素材，超过舒适区 %d —— 网格会挤，'
              '考虑拆成两张或压缩清单' % (len(items), a.limit), file=sys.stderr)

    # base 指向被剔掉的素材时清掉，否则 build_sheet_prompt 找不到那一项
    names = {i['name'] for i in items}
    for i in items:
        if i.get('base') not in names:
            i.pop('base', None)

    spec = {'name': plan.get('pack_id') or 'pack',
            'theme': plan.get('theme') or '',
            'style': plan.get('art_style') or 'pixel',
            'size': a.size,
            'items': items}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with io.open(a.out, 'w', encoding='utf-8') as f:
        f.write(json.dumps(spec, ensure_ascii=False, indent=2))
    print(json.dumps({'out': a.out, 'count': len(items), 'skipped': skipped},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()

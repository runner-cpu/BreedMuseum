#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次请求出一张 asset sheet —— 出图这一步**委派给 image-generation-super skill**。

用法:
  python3 generate_sheet.py --prompt prompt.txt --out sheet.png \
      [--size 2848x1152] [--log logs/verbatim.json]
      [--skill-script /path/to/image-generation-super/scripts/generate_image.py]
      [--images img1.png [img2.png [img3.png]]]

**凭证不用调用方管**：命中 image-generation-super 时由它自己鉴权。只有退回内置直连
（找不到官方脚本、或 --direct）才需要环境变量 INTEGRATIONS_API_KEY。

出图后端的解析顺序（生产环境应命中前两条，走官方 skill）:
  1. --skill-script 显式指定
  2. 环境变量 IMAGE_GEN_SUPER_SCRIPT
  3. 若干约定位置（见 CANDIDATES），例如与本 skill 同级的 image-generation-super/
  4. 都找不到时才退回内置直连（--direct 可强制），并在 stdout 的 backend 字段标明

退出码:
  0  出图成功，stdout 打印 {"file":..., "size":..., "revised_prompt":..., "backend":...}
  3  被内容安全拦截（HTTP 400 moderation_blocked）——调用方应升级到下一个 prompt 变体
  1  其他失败

注意:
  - base64 由出图脚本自己落盘，绝不打到 stdout（避免灌进 Agent 上下文）。
  - size 只支持 1024x1024 / 1536x1024 / 1024x1536 / 2848x1152；sheet 固定用 2848x1152，
    实测这一档尺寸被严格遵守（1024x1024 反而经常返回 1254x1254）。
  - 已知网关坑：官方脚本在平台外直连时只发 X-Gateway-Authorization 会 401
    （token extraction failed for header 'Authorization'）。命中 401 时本脚本会
    自动退回内置直连（带标准 Authorization 头）并告警，不去改官方脚本。
  - --images 走图生图（editImage）：传 1-3 张本地图片路径，原样转发给
    image-generation-super 的 generate_image.py（它本来就支持 --images，不用改它）；
    直连兜底分支自己按 image-edits-api.md 的格式把图片编码进请求体的 images[].b64_json。
    不传 --images 时行为与之前完全一致（纯文生图）。
"""
import argparse, base64, io, json, os, subprocess, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_ROOT = os.path.dirname(HERE)
URL = os.environ.get('IMAGE_GENERATIONS_URL',
                     'https://app-dr6mrcqei51d-api-eLMlzK2Oljw9-gateway.appmiaoda.com/image2')
SIZES = ('1024x1024', '1536x1024', '1024x1536', '2848x1152')

# 出图/图生图脚本已复制进本 skill 的 scripts/ 目录（generate_image.py），直接用本地这份，
# 不再去找外部 image-generation-super —— 这样请求由本 skill 自己的脚本发出、用本 skill
# 自己注入的 INTEGRATIONS_API_KEY，计费独立。--skill-script / IMAGE_GEN_SUPER_SCRIPT
# 仍可显式覆盖（调试用），生产环境不传时恒命中下面这份本地副本。
CANDIDATES = [
    os.path.join(HERE, 'generate_image.py'),
]


def resolve_script(explicit):
    for p in [explicit, os.environ.get('IMAGE_GEN_SUPER_SCRIPT')] + CANDIDATES:
        if p and os.path.isfile(p):
            return p
    return None


def is_blocked(text):
    low = (text or '').lower()
    return 'http 400' in low and ('moderation' in low or 'safety' in low)


def via_skill(script, prompt, size, out, images=None):
    """调 image-generation-super 的 generate_image.py。返回 (状态, 数据)。

    状态: 'ok' | 'blocked' | 'auth' | 'error'
    """
    argv = [sys.executable, script, '--prompt', prompt, '--output', out, '--size', size]
    if images:
        argv += ['--images'] + list(images)
    p = subprocess.run(argv, capture_output=True, text=True)
    raw = ((p.stdout or '') + (p.stderr or '')).strip()
    if p.returncode == 0:
        try:
            d = json.loads((p.stdout or '').strip().splitlines()[-1])
        except Exception:
            d = {}
        return 'ok', {'revised_prompt': d.get('revised_prompt', ''), 'raw': raw}
    if is_blocked(raw):
        return 'blocked', {'raw': raw}
    if 'http 401' in raw.lower():
        return 'auth', {'raw': raw}
    return 'error', {'raw': raw}


def direct(key, prompt, size, out, images=None):
    """内置直连兜底：官方脚本不可用、或它因 401 打不通时用。

    --images 传了图片路径时走 editImage（多图编辑），格式与 image-edits-api.md 一致：
    请求体带 images[].b64_json，其余字段（model/prompt/size）不变。
    """
    body = {'model': 'gpt-image-2', 'prompt': prompt, 'size': size}
    if images:
        img_payload = []
        for p in list(images)[:3]:
            with open(p, 'rb') as f:
                encoded = base64.b64encode(f.read()).decode('ascii')
            ext = os.path.splitext(p)[1].lower()
            content_type = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                            '.webp': 'image/webp'}.get(ext, 'image/png')
            img_payload.append({'filename': os.path.basename(p),
                                'content_type': content_type, 'b64_json': encoded})
        body['images'] = img_payload
    req = urllib.request.Request(URL, data=json.dumps(body).encode('utf-8'), method='POST',
                                 headers={
        'Content-Type': 'application/json',
        'X-Gateway-Authorization': 'Bearer %s' % key,
        # 直连网关时必须带标准 Authorization 头，否则 401
        'Authorization': 'Bearer %s' % key,
    })
    with urllib.request.urlopen(req, timeout=600) as r:
        d = json.loads(r.read().decode('utf-8'))
    item = d['data'][0]
    # 兼容两种响应形状：文生图观测到 b64_json，editImage 观测到的响应里
    # b64_json 和 url 可能同时存在也可能只有一个——见
    # image-generation-super/references/image-edits-api.md 的示例响应字段表，
    # 与实测（两次探测得到过不同的字段组合）。优先 b64_json，没有才落到 url 下载。
    if item.get('b64_json'):
        with open(out, 'wb') as f:
            f.write(base64.b64decode(item['b64_json']))
    elif item.get('url'):
        with urllib.request.urlopen(urllib.request.Request(item['url']), timeout=120) as ir:
            img_bytes = ir.read()
        with open(out, 'wb') as f:
            f.write(img_bytes)
    else:
        raise KeyError("response data[0] has neither 'b64_json' nor 'url': %r" % (item,))
    return {'revised_prompt': item.get('revised_prompt', '')}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prompt', required=True, help='prompt 文件路径')
    ap.add_argument('--out', required=True)
    ap.add_argument('--size', default='2848x1152', choices=SIZES)
    ap.add_argument('--log', help='把原始返回（含 400 报文）存一份，便于复盘')
    ap.add_argument('--skill-script', help='image-generation-super 的 generate_image.py')
    ap.add_argument('--direct', action='store_true', help='跳过官方 skill，强制内置直连')
    ap.add_argument('--images', nargs='+', help='走图生图（editImage），1-3 张输入图片路径')
    a = ap.parse_args()

    key = os.environ.get('INTEGRATIONS_API_KEY')
    with io.open(a.prompt, encoding='utf-8') as f:
        prompt = f.read().strip()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)

    def dump(obj):
        if not a.log:
            return
        os.makedirs(os.path.dirname(os.path.abspath(a.log)), exist_ok=True)
        with io.open(a.log, 'w', encoding='utf-8') as f:
            f.write(json.dumps(obj, ensure_ascii=False, indent=2))

    script = None if a.direct else resolve_script(a.skill_script)
    backend, rev = None, ''

    if script:
        st, d = via_skill(script, prompt, a.size, a.out, a.images)
        if st == 'ok':
            backend, rev = 'image-generation-super', d['revised_prompt']
        elif st == 'blocked':
            dump({'status': 400, 'backend': script, 'body': d['raw'][:2000]})
            print(d['raw'], file=sys.stderr)
            sys.exit(3)
        elif st == 'auth':
            print('image-generation-super 直连返回 401（它只发 X-Gateway-Authorization），'
                  '退回内置直连；平台内运行不会有这个问题', file=sys.stderr)
        else:
            dump({'status': 'error', 'backend': script, 'body': d['raw'][:2000]})
            print(d['raw'], file=sys.stderr)
            sys.exit(1)
    else:
        print('未找到 image-generation-super 的 generate_image.py，使用内置直连。'
              '生产环境请用 --skill-script 或 IMAGE_GEN_SUPER_SCRIPT 指向官方脚本',
              file=sys.stderr)

    if backend is None:
        # 走到这里才需要凭证：平台内 image-generation-super 自己鉴权，调用方不用管 key
        if not key:
            print('内置直连需要环境变量 INTEGRATIONS_API_KEY；平台内应命中 '
                  'image-generation-super（它自己鉴权），不要在调用侧传 key',
                  file=sys.stderr)
            sys.exit(1)
        try:
            d = direct(key, prompt, a.size, a.out, a.images)
        except urllib.error.HTTPError as e:
            raw = e.read().decode('utf-8', 'replace')
            dump({'status': e.code, 'backend': 'direct', 'body': raw})
            print('HTTP %d: %s' % (e.code, raw), file=sys.stderr)
            low = raw.lower()
            sys.exit(3 if e.code == 400 and ('moderation' in low or 'safety' in low) else 1)
        except Exception as e:
            dump({'error': str(e), 'backend': 'direct'})
            print('请求失败: %s' % e, file=sys.stderr)
            sys.exit(1)
        backend, rev = 'direct', d['revised_prompt']

    dump({'status': 200, 'backend': backend, 'size': a.size,
          'revised_prompt': rev, 'file': a.out})
    print(json.dumps({'file': a.out, 'size': a.size, 'revised_prompt': rev,
                      'backend': backend}, ensure_ascii=False))


if __name__ == '__main__':
    main()

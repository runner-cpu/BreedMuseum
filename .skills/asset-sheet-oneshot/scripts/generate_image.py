#!/usr/bin/env python3
"""
Generate or edit an image via Miaoda-ImageGen-Super and save the result to disk.
Base64 data never enters the LLM context.

Usage:
    # Text-to-image
    python3 generate_image.py --prompt "a cat" --output image.png [--size 1024x1024]

    # Image editing (1-3 input images)
    python3 generate_image.py --prompt "make it anime" --output image_v2.png \
        --images /path/to/img1.png [/path/to/img2.png]

Environment:
    INTEGRATIONS_API_KEY - platform-injected API key (required)

Exit codes:
    0 - success, prints JSON: {"file": "...", "revised_prompt": "...", "size": "..."}
    1 - API or argument error
"""

import os
import sys
import json
import base64
import argparse
import time
import tempfile
import socket
import ipaddress
from urllib.parse import urlsplit
import urllib.request
import urllib.error


GENERATIONS_URL = os.environ.get(
    "IMAGE_GENERATIONS_URL",
    "https://app-dr6mrcqei51d-api-eLMlzK2Oljw9-gateway.appmiaoda.com/image2",
)
EDITS_URL = os.environ.get(
    "IMAGE_EDITS_URL",
    "https://app-dr6mrcqei51d-api-GYX1MK2A15Xa-gateway.appmiaoda.com/image2",
)


def parse_args():
    """解析命令行参数。"""
    p = argparse.ArgumentParser()
    p.add_argument("--prompt", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--size", default="1024x1024")
    p.add_argument("--images", nargs="+", default=[])
    return p.parse_args()


class ImageFailure(Exception):
    def __init__(self, code, retryable=False):
        self.code, self.retryable = code, retryable
        super().__init__(code)


def save_image(b64: str, path: str):
    try:
        raw = base64.b64decode(b64, validate=True)
    except (ValueError, TypeError):
        raise ImageFailure("invalid_base64_no_regeneration")
    save_bytes(raw, path)


def save_bytes(raw, path):
    valid = (raw.startswith(b"\x89PNG\r\n\x1a\n") or raw.startswith(b"\xff\xd8\xff")
             or (raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"))
    if not valid:
        raise ImageFailure("invalid_image_no_regeneration")
    dest = os.path.abspath(path)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(dest), prefix=".image-")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)


def request_json(req):
    # Exact same Request/body on retry. Never retry ambiguous successful responses.
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                raw = resp.read(96 * 1024 * 1024 + 1)
            if len(raw) > 96 * 1024 * 1024:
                raise ImageFailure("response_too_large_no_regeneration")
            try:
                d = json.loads(raw)
            except (ValueError, UnicodeError):
                raise ImageFailure("invalid_json_outcome_uncertain")
            if not isinstance(d, dict):
                raise ImageFailure("invalid_schema_outcome_uncertain")
            if d.get("error"):
                err = d["error"]
                code = err.get("code") if isinstance(err, dict) else None
                # Only explicitly identified transient failures; no blanket error retry.
                transient = code in ("server_error", "internal_server_error", "service_unavailable", "rate_limit_exceeded")
                raise ImageFailure("upstream_error", transient and not d.get("data"))
            return d
        except urllib.error.HTTPError as e:
            try: error_body = json.loads(e.read(65536))
            except (ValueError, UnicodeError): error_body = {}
            explicit = isinstance(error_body, dict) and error_body.get("error") and not error_body.get("data")
            retry = e.code == 429 or (e.code in (500, 502, 503, 504) and bool(explicit))
            failure = ImageFailure("http_" + str(e.code), retry)
        except ImageFailure as e:
            failure = e
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            raise ImageFailure("network_outcome_uncertain_no_regeneration")
        if not failure.retryable or attempt == 1:
            raise failure
        print(json.dumps({"event":"retry", "attempt":2, "reason":failure.code}), file=sys.stderr)
        time.sleep(2)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def download_image(url):
    u = urlsplit(url)
    if u.scheme != "https" or not u.hostname or u.username or u.password or u.port not in (None, 443):
        raise ImageFailure("unsafe_result_url")
    addresses = socket.getaddrinfo(u.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ImageFailure("unsafe_result_host")
    # No gateway credentials sent to the media host; redirects intentionally refused.
    opener = urllib.request.build_opener(NoRedirect())
    for attempt in range(2):
        try:
            with opener.open(urllib.request.Request(url), timeout=60) as r:
                data = r.read(64 * 1024 * 1024 + 1)
            if len(data) > 64 * 1024 * 1024: raise ImageFailure("image_too_large")
            return data
        except (urllib.error.URLError, TimeoutError):
            if attempt: raise ImageFailure("result_download_failed_no_regeneration")
            time.sleep(2)


def persist_result(d, output):
    data = d.get("data")
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise ImageFailure("missing_image_outcome_uncertain")
    item = data[0]
    if isinstance(item.get("b64_json"), str) and item["b64_json"]:
        save_image(item["b64_json"], output)
    elif isinstance(item.get("url"), str) and item["url"]:
        save_bytes(download_image(item["url"]), output)
        print(json.dumps({"event":"url_fallback", "regenerated":False}), file=sys.stderr)
    else:
        raise ImageFailure("missing_image_outcome_uncertain")


def create_image(api_key: str, prompt: str, size: str, output: str):
    """调用文生图接口，生成图片并保存到 output。"""
    payload = json.dumps({"model": "gpt-image-2", "prompt": prompt, "size": size, "n": 1, "response_format": "b64"}).encode()
    req = urllib.request.Request(
        GENERATIONS_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    d = request_json(req)
    persist_result(d, output)
    return d


def edit_image(api_key: str, prompt: str, size: str, images: list, output: str):
    """调用 CFC JSON Base64 图生图接口（最多 3 张输入图）。"""
    image_payload = []
    if not 1 <= len(images) <= 3:
        raise ImageFailure("expected_1_to_3_images")
    for p in images:
        with open(p, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")
        ext = os.path.splitext(p)[1].lower()
        content_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
        }.get(ext, "image/png")
        image_payload.append({
            "filename": os.path.basename(p),
            "content_type": content_type,
            "b64_json": encoded,
        })

    payload = json.dumps({
        "model": "gpt-image-2",
        "prompt": prompt,
        "size": size,
        "images": image_payload,
        "n": 1,
        "response_format": "b64",
    }).encode("utf-8")
    req = urllib.request.Request(
        EDITS_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    d = request_json(req)
    persist_result(d, output)
    return d


def main():
    """入口：根据是否传入 --images 分别走文生图或图生图流程，输出结果 JSON。"""
    args = parse_args()
    if not args.prompt.strip() or len(args.images) > 3:
        raise ImageFailure("invalid_arguments")
    if any(os.path.realpath(args.output) == os.path.realpath(i) for i in args.images):
        raise ImageFailure("output_must_not_overwrite_input")
    api_key = os.environ.get("INTEGRATIONS_API_KEY", "")
    if not api_key:
        print("INTEGRATIONS_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    if args.images:
        d = edit_image(api_key, args.prompt, args.size, args.images, args.output)
    else:
        d = create_image(api_key, args.prompt, args.size, args.output)

    print(json.dumps({
        "file": args.output,
        "revised_prompt": d["data"][0].get("revised_prompt", ""),
        "size": d.get("size", args.size),
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": e.code if isinstance(e, ImageFailure) else type(e).__name__, "action":"stop_do_not_bypass_script"}), file=sys.stderr)
        sys.exit(1)
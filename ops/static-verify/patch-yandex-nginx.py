#!/usr/bin/env python3
"""Idempotently insert exact-match nginx location for Yandex HTML verification."""
from __future__ import annotations

import pathlib
import sys

MARKER = "yandex_43f97ab3236b6cfd.html"
BLOCK = """
    location = /yandex_43f97ab3236b6cfd.html {
        alias /opt/steam-app/static-verify/yandex_43f97ab3236b6cfd.html;
        default_type text/html;
        charset utf-8;
    }
""".lstrip("\n")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: patch-yandex-nginx.py <nginx-site-path>", file=sys.stderr)
        return 2
    path = pathlib.Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        print("step:nginx_location_already_present")
        return 0
    needle_comment = "    # 所有请求代理到 Next.js\n    location / {"
    if needle_comment in text:
        text = text.replace(needle_comment, BLOCK + "\n" + needle_comment, 1)
    else:
        idx = text.rfind("\n    location / {")
        if idx < 0:
            idx = text.rfind("\nlocation / {")
        if idx < 0:
            print("could not find catch-all location / to insert before", file=sys.stderr)
            return 1
        text = text[: idx + 1] + BLOCK + "\n" + text[idx + 1 :]
    path.write_text(text, encoding="utf-8")
    print("step:nginx_patched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

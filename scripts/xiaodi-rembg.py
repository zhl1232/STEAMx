#!/usr/bin/env python3
"""小迪源图 AI 去底：scripts/xiaodi-src/<state>.jpg -> <state>.rgba.png

用 rembg(isnet-general-use) 对整张 4 姿势拼图做分割，输出带透明通道的 PNG，
供 scripts/xiaodi-frames.mjs 切帧对齐使用。

运行（首次会下载模型到 ~/.u2net/）：
  python3 -m venv ~/.venvs/xiaodi && ~/.venvs/xiaodi/bin/pip install rembg onnxruntime pillow numpy
  ~/.venvs/xiaodi/bin/python scripts/xiaodi-rembg.py
"""

from pathlib import Path

from PIL import Image
from rembg import new_session, remove

SRC_DIR = Path(__file__).resolve().parent / "xiaodi-src"
STATES = ["idle", "listening", "thinking", "speaking", "success", "error", "working"]
MODEL = "isnet-general-use"


def main() -> None:
    session = new_session(MODEL)
    for state in STATES:
        src = SRC_DIR / f"{state}.jpg"
        if not src.exists():
            raise SystemExit(f"缺少源图: {src}")
        out = SRC_DIR / f"{state}.rgba.png"
        with Image.open(src) as im:
            result = remove(im.convert("RGB"), session=session)
        result.save(out)
        print(f"{state}: {out.name} {result.size}")


if __name__ == "__main__":
    main()

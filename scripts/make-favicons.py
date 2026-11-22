#!/usr/bin/env python3
"""从透明母版生成 dashboard favicon 资源。

依赖：Pillow、numpy（本机已具备；不进入 npm 依赖树）。

用法：
    python3 scripts/make-favicons.py

母版要求：RGBA PNG，背景已是透明（四角 alpha=0）。脚本会按 alpha 包围盒
裁切、加 8% 透明内边距、补成正方形，再导出 16/32/48 PNG、多尺寸 ICO，
以及 180×180 的 apple-touch-icon（品牌米白 #FDFDFD 不透明底）。
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/brand/logo-transparent.png"
PUBLIC = ROOT / "public"
APPLE_BG = (253, 253, 253)


def square_master() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    alpha = np.array(image.getchannel("A"))
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        raise SystemExit("母版 alpha 全为 0，无法生成 favicon")

    bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    content = image.crop(bbox)
    side = max(content.size)
    padding = round(side * 0.08)
    canvas = side + padding * 2

    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(
        content,
        ((canvas - content.width) // 2, (canvas - content.height) // 2),
        content,
    )
    return out


def main() -> None:
    master = square_master()
    PUBLIC.mkdir(parents=True, exist_ok=True)

    for size in (16, 32, 48):
        master.resize((size, size), Image.LANCZOS).save(
            PUBLIC / f"favicon-{size}x{size}.png"
        )

    # ICO 由 48×48 基础图生成 16/32/48 三档；PIL 会在保存时按 sizes 重采样。
    master.resize((48, 48), Image.LANCZOS).save(
        PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )

    apple = Image.new("RGBA", master.size, APPLE_BG + (255,))
    apple.alpha_composite(master)
    apple.convert("RGB").resize((180, 180), Image.LANCZOS).save(
        PUBLIC / "apple-touch-icon.png"
    )

    print(f"favicons written to {PUBLIC}")


if __name__ == "__main__":
    main()

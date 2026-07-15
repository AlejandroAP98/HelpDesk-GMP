"""Genera los iconos PWA para HelpDesk-GMP a partir de un diseno simple en SVG."""
from PIL import Image, ImageDraw
import os

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")

BRAND_BG = (37, 99, 235, 255)
BRAND_BG_LIGHT = (96, 165, 250, 255)
WHITE = (255, 255, 255, 255)


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if maskable:
        safe_zone = int(size * 0.1)
        radius = int(size * 0.18)
    else:
        safe_zone = 0
        radius = int(size * 0.22)

    rect = (safe_zone, safe_zone, size - safe_zone, size - safe_zone)
    draw.rounded_rectangle(rect, radius=radius, fill=BRAND_BG)

    cx, cy = size // 2, size // 2
    s = size // 6

    notch_w = int(s * 0.4)
    notch_h = int(s * 1.4)
    draw.rounded_rectangle(
        (cx - s - notch_w // 2, cy - s * 2 - notch_h // 2,
         cx - s + notch_w // 2, cy - s * 2 + notch_h // 2),
        radius=int(notch_w // 2), fill=BRAND_BG_LIGHT,
    )
    draw.rounded_rectangle(
        (cx + s - notch_w // 2, cy - s * 2 - notch_h // 2,
         cx + s + notch_w // 2, cy - s * 2 + notch_h // 2),
        radius=int(notch_w // 2), fill=BRAND_BG_LIGHT,
    )

    body_top = cy - s * 2
    body_bottom = cy + s * 2
    body_left = cx - s * 2
    body_right = cx + s * 2

    draw.rounded_rectangle(
        (body_left, body_top, body_right, body_bottom),
        radius=int(s * 0.3), outline=WHITE, width=int(s * 0.18),
    )

    dash_x = cx
    draw.line(
        (dash_x, body_top + int(s * 0.4),
         dash_x, body_bottom - int(s * 0.4)),
        fill=WHITE, width=int(s * 0.18),
    )

    return img


def main() -> None:
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
        ("icon-16.png", 16, False),
        ("icon-32.png", 32, False),
        ("icon-48.png", 48, False),
    ]
    for name, size, maskable in targets:
        out = os.path.join(PUBLIC_DIR, name)
        make_icon(size, maskable).save(out, "PNG", optimize=True)
        print(f"OK {name} ({size}px, maskable={maskable}) -> {out}")


if __name__ == "__main__":
    main()

"""Crop transparent padding and build compact WebP textures for Orb Merge."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


TARGET_LONG_EDGES = (72, 92, 116, 144, 176, 212, 252, 296, 344, 392)


def optimize(source: Path, destination: Path, target_long_edge: int) -> tuple[int, int]:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    visible = alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
    if visible is None:
        raise ValueError(f"{source} has no visible pixels")

    padding = 3
    left = max(0, visible[0] - padding)
    top = max(0, visible[1] - padding)
    right = min(image.width, visible[2] + padding)
    bottom = min(image.height, visible[3] + padding)
    image = image.crop((left, top, right, bottom))

    scale = min(1.0, target_long_edge / max(image.size))
    if scale < 1.0:
        size = tuple(max(1, round(value * scale)) for value in image.size)
        image = image.resize(size, Image.Resampling.LANCZOS)

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=84, method=6, alpha_quality=90)
    return image.size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Folder containing 1.PNG through 10.PNG")
    parser.add_argument("output", type=Path, help="Destination folder")
    args = parser.parse_args()

    total = 0
    for tier, edge in enumerate(TARGET_LONG_EDGES, start=1):
        destination = args.output / f"tier-{tier}.webp"
        size = optimize(args.input / f"{tier}.PNG", destination, edge)
        byte_count = destination.stat().st_size
        total += byte_count
        print(f"T{tier}: {size[0]}x{size[1]}, {byte_count} bytes")
    print(f"Total: {total} bytes")


if __name__ == "__main__":
    main()

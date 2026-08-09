#!/usr/bin/env python3
"""Convert generated flat-chroma enemy VFX art into a transparent PNG.

The generated source is intentionally preserved beside the combat-ready output so
the keying threshold can be revisited when an effect is art-directed later.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def smoothstep(value: float, low: float, high: float) -> float:
    t = max(0.0, min(1.0, (value - low) / (high - low)))
    return t * t * (3.0 - 2.0 * t)


def key_image(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = image.load()
    width, height = image.size

    # ImageGen is prompted with either pure green or magenta. Sampling every
    # corner keeps the utility tolerant of small compression/noise differences.
    samples = [
        pixels[x, y][:3]
        for x, y in (
            (0, 0),
            (width - 1, 0),
            (0, height - 1),
            (width - 1, height - 1),
            (width // 2, 0),
            (width // 2, height - 1),
        )
    ]
    key = tuple(sorted(channel)[len(samples) // 2] for channel in zip(*samples))

    keyed = Image.new("RGBA", image.size)
    output_pixels = keyed.load()
    for y in range(height):
        for x in range(width):
            red, green, blue, _ = pixels[x, y]
            distance = math.sqrt(
                (red - key[0]) ** 2
                + (green - key[1]) ** 2
                + (blue - key[2]) ** 2
            )
            alpha = round(255 * smoothstep(distance, 24, 104))
            if alpha == 0:
                output_pixels[x, y] = (0, 0, 0, 0)
                continue

            # Undo the chroma contribution on anti-aliased edge pixels. This
            # prevents green/magenta fringes over the ink-paper game backdrop.
            blend = alpha / 255
            recovered = []
            for observed, background in zip((red, green, blue), key):
                channel = (observed - (1 - blend) * background) / blend
                recovered.append(round(max(0, min(255, channel))))
            output_pixels[x, y] = (*recovered, alpha)

    output.parent.mkdir(parents=True, exist_ok=True)
    keyed.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    key_image(args.source, args.output)


if __name__ == "__main__":
    main()

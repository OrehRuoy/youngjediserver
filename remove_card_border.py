"""
Remove white outer border + shadow; transparent outside black card border.

Batch mode (default): overwrites every *.png under:
  client/assets/menaceofdarthmaul/
  client/assets/thejedicouncil/
  client/assets/battleofnaboo/

Run: py remove_card_border.py
Requires: pip install Pillow numpy
"""
from __future__ import annotations

from pathlib import Path
from typing import List

from PIL import Image
import numpy as np


def remove_border_and_shadow(input_path: Path, output_path: Path) -> None:
    with Image.open(input_path) as im:
        data = np.array(im.convert("RGBA"))
    h, w = data.shape[:2]

    def first_black_column(from_left: bool) -> int:
        for x in range(w) if from_left else range(w - 1, -1, -1):
            col = data[:, x, :3]
            if np.any(np.max(col, axis=1) < 60):
                return x
        return 0 if from_left else w - 1

    def first_black_row(from_top: bool) -> int:
        for y in range(h) if from_top else range(h - 1, -1, -1):
            row = data[y, :, :3]
            if np.any(np.max(row, axis=1) < 60):
                return y
        return 0 if from_top else h - 1

    left = first_black_column(True)
    right = first_black_column(False)
    top = first_black_row(True)
    bottom = first_black_row(False)

    # Do not expand right/bottom (+2 was pulling in white border / shadow).

    radius = min(25, (right - left) // 8, (bottom - top) // 8)
    yy, xx = np.ogrid[:h, :w]

    in_rect = (xx >= left) & (xx <= right) & (yy >= top) & (yy <= bottom)
    tl = (xx < left + radius) & (yy < top + radius) & (
        (xx - (left + radius)) ** 2 + (yy - (top + radius)) ** 2 > radius**2
    )
    tr = (xx > right - radius) & (yy < top + radius) & (
        (xx - (right - radius)) ** 2 + (yy - (top + radius)) ** 2 > radius**2
    )
    bl = (xx < left + radius) & (yy > bottom - radius) & (
        (xx - (left + radius)) ** 2 + (yy - (bottom - radius)) ** 2 > radius**2
    )
    br = (xx > right - radius) & (yy > bottom - radius) & (
        (xx - (right - radius)) ** 2 + (yy - (bottom - radius)) ** 2 > radius**2
    )
    mask = in_rect & ~tl & ~tr & ~bl & ~br

    data[:, :, 3] = data[:, :, 3] * mask

    # Peel outermost fringe: if the rightmost/bottommost opaque pixel on a line is
    # near-white (border bleed), drop it — avoids eating in-card white art.
    rch, gch, bch = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    border_white = (rch > 228) & (gch > 228) & (bch > 228)
    a = data[:, :, 3] > 0
    for _ in range(3):
        for y in range(h):
            xs = np.where(a[y, :])[0]
            if xs.size and border_white[y, xs[-1]]:
                data[y, xs[-1], 3] = 0
        a = data[:, :, 3] > 0
        for x in range(w):
            ys = np.where(a[:, x])[0]
            if ys.size and border_white[ys[-1], x]:
                data[ys[-1], x, 3] = 0
        a = data[:, :, 3] > 0
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(data).save(output_path, "PNG")


CARD_SETS = ("menaceofdarthmaul", "thejedicouncil", "battleofnaboo")


def main() -> None:
    root = Path(__file__).resolve().parent
    assets = root / "client" / "assets"
    if not assets.is_dir():
        raise SystemExit(f"Missing assets folder: {assets}")

    paths: List[Path] = []
    for set_name in CARD_SETS:
        folder = assets / set_name
        if not folder.is_dir():
            print(f"Skip (not found): {folder}")
            continue
        paths.extend(sorted(folder.rglob("*.png")))

    if not paths:
        raise SystemExit("No PNG files found under the card set folders.")

    ok, failed = 0, 0
    for p in paths:
        try:
            remove_border_and_shadow(p, p)
            print(f"OK: {p.relative_to(root)}")
            ok += 1
        except Exception as e:
            print(f"FAIL: {p.relative_to(root)} — {e}")
            failed += 1

    print(f"\nDone. {ok} overwritten, {failed} failed.")


if __name__ == "__main__":
    main()

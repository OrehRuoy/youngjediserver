#!/usr/bin/env python3
"""Convert GIF files to PNG.

Usage:
  python convert_gifs_to_png.py
    -> Converts assets/menaceofdarthmaul/light and dark (default).

  python convert_gifs_to_png.py <folder_path>
    -> Converts all GIFs in the given folder (e.g. client/assets/thejedicouncil/light).
"""
import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

# Script lives in client/scripts/; project root is client/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_ROOT = os.path.join(SCRIPT_DIR, "..", "assets", "menaceofdarthmaul")
DEFAULT_FOLDERS = ["dark", "light"]


def convert_folder(dir_path, folder_label=""):
    """Convert all GIFs in dir_path to PNG. Returns (converted_count, errors list)."""
    converted = 0
    errors = []
    if not os.path.isdir(dir_path):
        print("Skipping (not a directory):", dir_path)
        return converted, errors
    for name in os.listdir(dir_path):
        if not name.lower().endswith(".gif"):
            continue
        gif_path = os.path.join(dir_path, name)
        if not os.path.isfile(gif_path):
            continue
        png_name = os.path.splitext(name)[0] + ".png"
        png_path = os.path.join(dir_path, png_name)
        try:
            with Image.open(gif_path) as im:
                frame = im.convert("RGBA")
                frame.save(png_path, "PNG")
            label = os.path.join(folder_label, name) if folder_label else name
            print("Converted:", label, "->", png_name)
            converted += 1
        except Exception as e:
            errors.append((gif_path, str(e)))
    return converted, errors


def main():
    converted = 0
    errors = []
    if len(sys.argv) >= 2:
        # Single folder passed as argument
        dir_path = os.path.abspath(sys.argv[1])
        c, e = convert_folder(dir_path)
        converted += c
        errors.extend(e)
    else:
        # Default: menaceofdarthmaul/light and dark
        for folder in DEFAULT_FOLDERS:
            dir_path = os.path.join(ASSETS_ROOT, folder)
            c, e = convert_folder(dir_path, folder)
            converted += c
            errors.extend(e)
    if errors:
        print("\nErrors:", file=sys.stderr)
        for p, msg in errors:
            print(p, msg, file=sys.stderr)
    print("\nTotal converted:", converted)
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())

"""
hash_server.py — SHA-256 Image Hash Utility
Computes SHA-256 digest of an image file for integrity verification.
Args: <image_path>
Outputs JSON to stdout: { "sha256": str, "size_bytes": int, "format": str }
"""
import sys
import hashlib
import json
import os
from PIL import Image


def hash_image(image_path):
    try:
        # File-level SHA-256
        sha256 = hashlib.sha256()
        size = os.path.getsize(image_path)
        with open(image_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)

        # Get image metadata
        img = Image.open(image_path)
        fmt = img.format or 'PNG'
        width, height = img.size
        mode = img.mode

        print(json.dumps({
            "sha256": sha256.hexdigest(),
            "size_bytes": size,
            "format": fmt,
            "dimensions": f"{width}x{height}",
            "mode": mode,
            "capacity_chars": (width * height * 3) // 8 - 50  # approx usable chars
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: hash_server.py <image>"}))
        sys.exit(1)
    hash_image(sys.argv[1])

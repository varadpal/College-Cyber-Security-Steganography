"""
forensic_engine.py — Deep Region Discovery & Annotated Heatmap
High-quality composite forensic image with bounding box, logic steps,
and per-channel intensity gradient.
Args: <orig_path> <enc_path> <out_annotated_path>
"""
import sys
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os


def _apply_colormap_hot(intensity_norm: np.ndarray) -> np.ndarray:
    """Maps 0-1 float array to a hot colormap (RGB uint8)."""
    h, w = intensity_norm.shape
    rgb = np.zeros((h, w, 3), dtype=np.float32)

    # Black → blue (0.0-0.25)
    m = (intensity_norm < 0.25)
    t = intensity_norm[m] / 0.25
    rgb[m, 2] = t * 190

    # Blue → cyan (0.25-0.50)
    m = (intensity_norm >= 0.25) & (intensity_norm < 0.50)
    t = (intensity_norm[m] - 0.25) / 0.25
    rgb[m, 1] = t * 200
    rgb[m, 2] = 190 + t * 65

    # Cyan → yellow-orange (0.50-0.75)
    m = (intensity_norm >= 0.50) & (intensity_norm < 0.75)
    t = (intensity_norm[m] - 0.50) / 0.25
    rgb[m, 0] = t * 255
    rgb[m, 1] = 200 + t * 55
    rgb[m, 2] = 255 * (1 - t)

    # Yellow → bright red (0.75-1.0)
    m = (intensity_norm >= 0.75)
    t = (intensity_norm[m] - 0.75) / 0.25
    rgb[m, 0] = 255
    rgb[m, 1] = 255 * (1 - t * 0.75)
    rgb[m, 2] = 0

    return np.clip(rgb, 0, 255).astype(np.uint8)


def _load_fonts():
    for path in [
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Courier.dfont",
        "/Library/Fonts/Courier New.ttf",
    ]:
        try:
            return ImageFont.truetype(path, 12), ImageFont.truetype(path, 11)
        except Exception:
            pass
    d = ImageFont.load_default()
    return d, d


def analyze_v2(orig_path: str, enc_path: str, out_path: str):
    try:
        orig_img = Image.open(orig_path).convert('RGB')
        enc_img  = Image.open(enc_path).convert('RGB')
    except Exception as e:
        print(json.dumps({"error": f"Load failed: {str(e)}"}))
        sys.exit(1)

    if orig_img.size != enc_img.size:
        print(json.dumps({"error": "Dimensions mismatch. Cannot compare."}))
        sys.exit(1)

    width, height = orig_img.size
    orig_arr = np.array(orig_img, dtype=np.float32)
    enc_arr  = np.array(enc_img,  dtype=np.float32)

    # ── Pixel-level difference ─────────────────────────────────────────────
    diff        = np.abs(orig_arr - enc_arr)
    intensity   = np.max(diff, axis=2)           # (H, W)
    changed_mask = intensity > 0
    changed_count = int(np.sum(changed_mask))

    # ── Metrics ────────────────────────────────────────────────────────────
    mse  = float(np.mean((orig_arr - enc_arr) ** 2))
    psnr = round(10 * np.log10((255.0 ** 2) / mse), 2) if mse > 0 else 99.99

    if changed_count == 0:
        print(json.dumps({
            "found": False,
            "message": "No bit-level variance detected. Images are binary identical.",
            "logic_steps": [
                "Computing pixel-wise Δ matrix (|A - B|) ...",
                "Maximum channel difference: 0",
                "Sum of Δ = 0 — no LSB modifications detected.",
                "Conclusion: Images are binary identical."
            ]
        }))
        return

    # ── Bounding box ───────────────────────────────────────────────────────
    coords = np.argwhere(changed_mask)
    y1, x1 = [int(v) for v in coords.min(axis=0)]
    y2, x2 = [int(v) for v in coords.max(axis=0)]
    bbox = [x1, y1, x2, y2]
    rect_w = x2 - x1 + 1
    rect_h = y2 - y1 + 1

    logic_steps = [
        f"Step 1 — Computing pixel-wise Δ matrix (|A − B|) across all RGB channels.",
        f"Step 2 — Max channel difference per pixel; {changed_count:,} anomalous pixels found.",
        f"Step 3 — Normalizing intensity to [0, 1] relative to 8-bit range.",
        f"Step 4 — Applying hot colormap (black→blue→cyan→yellow→red).",
        f"Step 5 — Gaussian blur (σ=1.4) for smooth edge transitions.",
        f"Step 6 — Region clustering: argwhere(mask) → coordinate set.",
        f"Step 7 — Bounding rectangle: min/max of coordinate set.",
        f"Step 8 — Payload boundary confirmed at ({x1},{y1}) → ({x2},{y2}).",
        f"Step 9 — Payload area: {rect_w}×{rect_h} px = {rect_w*rect_h:,} total pixels.",
        f"Step 10 — Annotating forensic canvas with boundary markers.",
    ]

    # ── Build colormap heatmap ─────────────────────────────────────────────
    int_norm   = intensity / 255.0
    cmap_arr   = _apply_colormap_hot(int_norm)
    cmap_img   = Image.fromarray(cmap_arr, 'RGB')
    cmap_blur  = cmap_img.filter(ImageFilter.GaussianBlur(radius=1.4))
    cmap_arr   = np.array(cmap_blur, dtype=np.float32)

    # Composite: dim original + overlay
    base        = orig_arr * 0.18
    alpha       = np.clip(int_norm * 3.5, 0.0, 1.0)[:, :, np.newaxis]
    composite   = base * (1 - alpha) + cmap_arr * alpha
    composite   = np.clip(composite, 0, 255).astype(np.uint8)

    # ── Canvas with padding ────────────────────────────────────────────────
    PAD    = 90
    canvas = Image.new('RGB', (width, height + PAD), (6, 6, 16))
    canvas.paste(Image.fromarray(composite), (0, 0))

    draw          = ImageDraw.Draw(canvas)
    font_med, font_sm = _load_fonts()

    # ── Bounding box overlay (3px neon green) ─────────────────────────────
    BOX_COLOR = (0, 255, 80)
    CORNER    = 10          # corner tick length
    for t in range(3):
        draw.rectangle([x1-t, y1-t, x2+t, y2+t], outline=BOX_COLOR)

    # Corner ticks for a more professional "crosshair" look
    # Top-left
    draw.line([x1-6, y1, x1+CORNER, y1], fill=BOX_COLOR, width=2)
    draw.line([x1, y1-6, x1, y1+CORNER], fill=BOX_COLOR, width=2)
    # Top-right
    draw.line([x2+6, y1, x2-CORNER, y1], fill=BOX_COLOR, width=2)
    draw.line([x2, y1-6, x2, y1+CORNER], fill=BOX_COLOR, width=2)
    # Bottom-left
    draw.line([x1-6, y2, x1+CORNER, y2], fill=BOX_COLOR, width=2)
    draw.line([x1, y2+6, x1, y2-CORNER], fill=BOX_COLOR, width=2)
    # Bottom-right
    draw.line([x2+6, y2, x2-CORNER, y2], fill=BOX_COLOR, width=2)
    draw.line([x2, y2+6, x2, y2-CORNER], fill=BOX_COLOR, width=2)

    # Label box above the region
    lbl_txt = f" DATA_REGION  {rect_w}x{rect_h}px "
    lbl_y   = max(0, y1 - 20)
    lbl_x   = x1
    draw.rectangle([lbl_x - 1, lbl_y - 1, lbl_x + 160, lbl_y + 16], fill=(0, 0, 0))
    draw.text((lbl_x + 2, lbl_y + 2), lbl_txt, fill=(0, 255, 80), font=font_sm)

    # ── Metrics bar ───────────────────────────────────────────────────────
    row1_y = height + 7
    draw.text((4, row1_y),
              f"  MSE: {mse:.4f}   |   PSNR: {psnr} dB   |   "
              f"MODIFIED: {changed_count:,} px  ({changed_count/(width*height)*100:.3f}%)   |   DIM: {width}x{height}",
              fill=(0, 220, 220), font=font_med)

    # ── Coordinates row ───────────────────────────────────────────────────
    row2_y = height + 26
    draw.text((4, row2_y),
              f"  PAYLOAD_BOX: ({x1}, {y1}) → ({x2}, {y2})   |   "
              f"AREA: {rect_w}×{rect_h} = {rect_w*rect_h:,} px",
              fill=(0, 200, 100), font=font_sm)

    # ── Legend bar ────────────────────────────────────────────────────────
    legend_y = height + 50
    legend_w = min(260, width - 8)
    for i in range(legend_w):
        t     = i / max(legend_w - 1, 1)
        arr   = np.array([[t]], dtype=np.float32)
        color = _apply_colormap_hot(arr)[0, 0]
        draw.line([(4 + i, legend_y), (4 + i, legend_y + 12)],
                  fill=(int(color[0]), int(color[1]), int(color[2])))
    draw.rectangle([4, legend_y, 4 + legend_w, legend_y + 12], outline=(80, 80, 80), width=1)
    draw.text((4, legend_y + 15), "NO CHANGE", fill=(120, 120, 120), font=font_sm)
    draw.text((4 + legend_w - 70, legend_y + 15), "MAX CHANGE", fill=(255, 80, 80), font=font_sm)

    # ── Watermark ─────────────────────────────────────────────────────────
    draw.text((width - 240, 6), "STEGANOVAULT // DEEP SCAN v2.1", fill=(0, 180, 220), font=font_sm)

    canvas.save(out_path, compress_level=6)

    print(json.dumps({
        "found":       True,
        "bbox":        bbox,
        "metrics": {
            "mse":             round(mse, 4),
            "psnr":            psnr,
            "changed_pixels":  changed_count,
            "percent_changed": round(changed_count / (width * height) * 100, 4),
            "dimensions":      f"{width}x{height}",
            "payload_dim":     f"{rect_w}x{rect_h}",
        },
        "logic_steps": logic_steps
    }))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: forensic_engine.py <orig> <enc> <out>"}))
        sys.exit(1)
    analyze_v2(sys.argv[1], sys.argv[2], sys.argv[3])

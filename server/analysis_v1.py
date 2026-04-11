"""
analysis_v1.py — Professional Differential Forensic Heatmap
Generates a high-quality composite heatmap with:
  - Per-channel difference magnitude (not just binary mask)
  - Smooth intensity gradient (blue -> yellow -> red)
  - Original image as a dimmed base layer
  - Color legend bar and metric text overlay
Args: <orig_path> <enc_path> <out_heatmap_path>
"""
import sys
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

def _apply_colormap_hot(intensity_norm):
    """
    Maps [0..1] to a 'Hot' style colormap:
    0.0 → black
    0.25 → deep blue
    0.5 → cyan/teal
    0.75 → yellow-orange
    1.0 → bright red/white
    We use a 4-stop gradient for maximum visual impact.
    """
    h, w = intensity_norm.shape
    rgb = np.zeros((h, w, 3), dtype=np.float32)

    # Stop 1: 0.0-0.25 — black to deep blue
    m = (intensity_norm >= 0.0) & (intensity_norm < 0.25)
    t = intensity_norm[m] / 0.25
    rgb[m, 0] = 0
    rgb[m, 1] = 0
    rgb[m, 2] = t * 200

    # Stop 2: 0.25-0.50 — deep blue to cyan
    m = (intensity_norm >= 0.25) & (intensity_norm < 0.50)
    t = (intensity_norm[m] - 0.25) / 0.25
    rgb[m, 0] = 0
    rgb[m, 1] = t * 210
    rgb[m, 2] = 200 + t * 55

    # Stop 3: 0.50-0.75 — cyan to yellow-orange
    m = (intensity_norm >= 0.50) & (intensity_norm < 0.75)
    t = (intensity_norm[m] - 0.50) / 0.25
    rgb[m, 0] = t * 255
    rgb[m, 1] = 210 + t * 45
    rgb[m, 2] = 255 * (1 - t)

    # Stop 4: 0.75-1.0 — yellow to hot red
    m = (intensity_norm >= 0.75)
    t = (intensity_norm[m] - 0.75) / 0.25
    rgb[m, 0] = 255
    rgb[m, 1] = 255 * (1 - t * 0.7)
    rgb[m, 2] = 0

    return np.clip(rgb, 0, 255).astype(np.uint8)


def _draw_legend(draw, x, y, w, h, font_small):
    """Draw horizontal gradient legend bar with labels."""
    steps = 256
    step_w = max(1, w // steps)
    for i in range(steps):
        t = i / (steps - 1)
        arr = np.array([[t]], dtype=np.float32)
        color = _apply_colormap_hot(arr)[0, 0]
        x0 = x + int(i * w / steps)
        draw.rectangle([x0, y, x0 + step_w, y + h],
                       fill=(int(color[0]), int(color[1]), int(color[2])))
    # Border
    draw.rectangle([x, y, x + w, y + h], outline=(255, 255, 255), width=1)
    # Labels
    draw.text((x, y + h + 3), "0 (no change)", fill=(180, 180, 180), font=font_small)
    draw.text((x + w - 70, y + h + 3), "255 (max)", fill=(255, 80, 80), font=font_small)


def analyze_v1(orig_path, enc_path, out_path):
    try:
        orig_img = Image.open(orig_path).convert('RGB')
        enc_img  = Image.open(enc_path).convert('RGB')
    except Exception as e:
        print(json.dumps({"error": f"Load failed: {str(e)}"}))
        sys.exit(1)

    if orig_img.size != enc_img.size:
        print(json.dumps({"error": "Dimensions mismatch. Images must be the same size."}))
        sys.exit(1)

    width, height = orig_img.size
    orig_arr = np.array(orig_img, dtype=np.float32)
    enc_arr  = np.array(enc_img,  dtype=np.float32)

    # ── Per-pixel difference magnitude ─────────────────────────────────────
    diff_arr = np.abs(orig_arr - enc_arr)           # shape (H, W, 3)
    intensity = np.max(diff_arr, axis=2)            # worst-case channel  (H, W)

    changed_mask  = intensity > 0
    changed_count = int(np.sum(changed_mask))

    # ── Metrics ─────────────────────────────────────────────────────────────
    mse  = float(np.mean((orig_arr - enc_arr) ** 2))
    if mse > 0:
        psnr = round(10 * np.log10((255.0 ** 2) / mse), 2)
    else:
        psnr = 99.99

    # ── Normalise intensity for colormap ────────────────────────────────────
    max_val = float(intensity.max()) if intensity.max() > 0 else 1.0
    intensity_norm = intensity / 255.0   # keep relative to full 8-bit range

    # ── Build colormap layer ─────────────────────────────────────────────────
    colormap_arr = _apply_colormap_hot(intensity_norm)   # (H, W, 3)

    # ── Glow: slight gaussian blur on hot spots for smoothness ───────────────
    colormap_img = Image.fromarray(colormap_arr, 'RGB')
    blurred      = colormap_img.filter(ImageFilter.GaussianBlur(radius=1.2))
    colormap_arr = np.array(blurred, dtype=np.float32)

    # ── Composite: dim original + overlay colormap ───────────────────────────
    # Original dims to 25% so hot spots dominate
    base = orig_arr * 0.20
    # Where there is no change keep a 35% ghost so the structure is visible
    overlay_alpha = np.clip(intensity_norm * 3.0, 0.0, 1.0)[:, :, np.newaxis]
    composite = base * (1 - overlay_alpha) + colormap_arr * overlay_alpha
    composite  = np.clip(composite, 0, 255).astype(np.uint8)

    # ── Canvas: add padding at bottom for legend + metrics ───────────────────
    PAD = 80
    canvas_h = height + PAD
    canvas = Image.new('RGB', (width, canvas_h), (8, 8, 18))
    canvas.paste(Image.fromarray(composite), (0, 0))

    draw = ImageDraw.Draw(canvas)

    # ── Load fonts (fallback to default) ───────────────────────────────────
    try:
        font_small = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 11)
        font_med   = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 13)
    except Exception:
        font_small = ImageFont.load_default()
        font_med   = ImageFont.load_default()

    # ── Metric text row ─────────────────────────────────────────────────────
    text_y  = height + 6
    metrics_line = (
        f"  MSE: {mse:.4f}   |   "
        f"PSNR: {psnr} dB   |   "
        f"MODIFIED: {changed_count:,} px   |   "
        f"DENSITY: {changed_count/(width*height)*100:.3f}%   |   "
        f"DIM: {width}x{height}"
    )
    draw.text((4, text_y), metrics_line, fill=(0, 220, 220), font=font_med)

    # ── Legend bar ──────────────────────────────────────────────────────────
    legend_x = 4
    legend_y = height + 32
    legend_w = min(280, width - 8)
    legend_h = 14
    _draw_legend(draw, legend_x, legend_y, legend_w, legend_h, font_small)
    draw.text((legend_x, legend_y - 14), "PIXEL CHANGE INTENSITY", fill=(140, 140, 160), font=font_small)

    # ── Bounding box annotation if data was found ────────────────────────────
    if changed_count > 0:
        coords = np.argwhere(changed_mask)
        y1_b, x1_b = coords.min(axis=0)
        y2_b, x2_b = coords.max(axis=0)
        BOX_COLOR = (0, 255, 100)
        for thick in range(3):
            draw.rectangle(
                [x1_b - thick, y1_b - thick, x2_b + thick, y2_b + thick],
                outline=BOX_COLOR
            )
        label_x = max(0, x1_b)
        label_y = max(0, y1_b - 20)
        draw.rectangle([label_x, label_y, label_x + 140, label_y + 16], fill=(0, 0, 0))
        draw.text(
            (label_x + 3, label_y + 2),
            f"DATA_REGION ({x2_b-x1_b}x{y2_b-y1_b})",
            fill=(0, 255, 100),
            font=font_small
        )

    # ── Title watermark in top-right ─────────────────────────────────────────
    title = "STEGANOVAULT // FORENSIC HEATMAP"
    draw.text((width - 240, 6), title, fill=(0, 180, 220), font=font_small)

    canvas.save(out_path, compress_level=6)

    print(json.dumps({
        "mse":             round(mse, 4),
        "psnr":            psnr,
        "changed_pixels":  changed_count,
        "percent_changed": round(changed_count / (width * height) * 100, 4),
        "dimensions":      f"{width}x{height}"
    }))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: analysis_v1.py <orig> <enc> <out>"}))
        sys.exit(1)
    analyze_v1(sys.argv[1], sys.argv[2], sys.argv[3])

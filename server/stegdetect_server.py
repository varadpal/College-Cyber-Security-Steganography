"""
stegdetect_server.py — Chi-Square Statistical Steganalysis Attack
Performs a chi-square test on LSB distributions to detect hidden data.
Args: <image_path>
Outputs JSON to stdout: { "score": float, "verdict": str, "confidence": float }
"""
import sys
import json
import numpy as np
from PIL import Image


def chi_square_attack(image_path):
    try:
        img = Image.open(image_path).convert('RGB')
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    arr = np.array(img)
    channels = ['Red', 'Green', 'Blue']
    results = []

    for c, ch_name in enumerate(channels):
        channel = arr[:, :, c].flatten().astype(int)

        # Count occurrences of each pixel value (0-255)
        observed = np.bincount(channel, minlength=256).astype(float)

        # Chi-square test: pair values (0,1), (2,3), ..., (254,255)
        # In a steganographically-modified image, the LSBs are randomized,
        # so each pair should have nearly equal counts.
        chi_sq = 0.0
        pairs_tested = 0
        for i in range(0, 256, 2):
            p0 = observed[i]
            p1 = observed[i + 1]
            expected = (p0 + p1) / 2.0
            if expected > 0:
                chi_sq += ((p0 - expected) ** 2) / expected
                chi_sq += ((p1 - expected) ** 2) / expected
                pairs_tested += 1

        # Degrees of freedom = pairs_tested - 1
        # Normalize score to a 0-100 confidence that data IS hidden
        # Low chi-square means values are very evenly distributed (suspicious!)
        # We use chi-sq per pair as our score
        normalized = chi_sq / max(pairs_tested, 1)
        # Higher normalized means MORE natural distribution (less suspicious)
        # We invert: low normalized value = high confidence of steganography
        confidence_raw = max(0.0, 1.0 - (normalized / 100.0))
        results.append({
            "channel": ch_name,
            "chi_sq": round(float(chi_sq), 2),
            "confidence": round(float(confidence_raw * 100), 1)
        })

    avg_confidence = sum(r["confidence"] for r in results) / 3

    if avg_confidence > 70:
        verdict = "LIKELY_ENCODED"
        assessment = "High probability of hidden data detected via LSB analysis."
    elif avg_confidence > 40:
        verdict = "INCONCLUSIVE"
        assessment = "Statistical anomalies detected. May contain hidden data."
    else:
        verdict = "LIKELY_CLEAN"
        assessment = "No significant statistical anomalies detected."

    print(json.dumps({
        "verdict": verdict,
        "assessment": assessment,
        "avg_confidence": round(avg_confidence, 1),
        "channels": results
    }))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: stegdetect_server.py <image>"}))
        sys.exit(1)
    chi_square_attack(sys.argv[1])

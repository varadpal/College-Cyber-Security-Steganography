"""
encode_server.py — server-side encode script
Called by the Node route with args: <input_image> <message> <output_image>
Exits 0 on success, 1 on failure (stderr contains the error).
"""
import sys
import os
from PIL import Image

def message_to_binary(message):
    return ''.join(format(ord(c), '08b') for c in message)

def encode_image(image_path, message, output_path):
    try:
        img = Image.open(image_path).convert('RGB')
        
        # Add a subtle visual indicator for the developer that something is hidden here
        # Doing this BEFORE LSB encoding ensures we don't accidentally corrupt the hidden data payload!
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        w, h = img.size
        # Make a visible red square in the top-right corner (size is 3% of width, minimum 20px)
        box_size = max(20, int(w * 0.03))
        draw.rectangle([w - box_size - 10, 10, w - 10, 10 + box_size], fill=(255, 0, 0))
        
    except Exception as e:
        print(f"Cannot open image: {e}", file=sys.stderr)
        sys.exit(1)

    pixels = img.load()
    # Delimiter: 16-bit sequence 1111111111111110
    binary_message = message_to_binary(message) + "1111111111111110"
    width, height = img.size

    if len(binary_message) > width * height * 3:
        print("Message too long for this image.", file=sys.stderr)
        sys.exit(1)

    data_index = 0
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            if data_index < len(binary_message):
                r = (r & ~1) | int(binary_message[data_index]); data_index += 1
            if data_index < len(binary_message):
                g = (g & ~1) | int(binary_message[data_index]); data_index += 1
            if data_index < len(binary_message):
                b = (b & ~1) | int(binary_message[data_index]); data_index += 1
            pixels[x, y] = (r, g, b)
            if data_index >= len(binary_message):
                break
        if data_index >= len(binary_message):
            break

    img.save(output_path, format='PNG')
    print("OK")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: encode_server.py <input> <message> <output>", file=sys.stderr)
        sys.exit(1)
    encode_image(sys.argv[1], sys.argv[2], sys.argv[3])

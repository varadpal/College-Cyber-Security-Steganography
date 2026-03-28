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
    except Exception as e:
        print(f"Cannot open image: {e}", file=sys.stderr)
        sys.exit(1)

    # Delimiter: 16-bit sequence 1111111111111110
    binary_message = message_to_binary(message) + "1111111111111110"
    width, height = img.size

    if len(binary_message) > width * height * 3:
        print("Message too long for this image.", file=sys.stderr)
        sys.exit(1)

    import random
    total_pixels = width * height
    pixels_needed = (len(binary_message) + 2) // 3

    if pixels_needed + 8 > total_pixels:
        print("Message too long for this image.", file=sys.stderr)
        sys.exit(1)

    # Ensure offset fits message
    # Try to fit entirely on one row to make a clean, small dotted box
    if pixels_needed < width:
        start_y = random.randint(1, height - 1)
        start_x = random.randint(8 if start_y == 0 else 0, width - pixels_needed - 1)
        start_pixel_index = start_y * width + start_x
    else:
        start_pixel_index = random.randint(8, total_pixels - pixels_needed)
        
    offset_bin = format(start_pixel_index, '024b')
    
    pixels = img.load()
    
    # 1. Write the 24-bit header (offset) in the first 8 pixels
    for i in range(8):
        y = i // width
        x = i % width
        r, g, b = pixels[x, y]
        r = (r & ~1) | int(offset_bin[i*3])
        g = (g & ~1) | int(offset_bin[i*3+1])
        b = (b & ~1) | int(offset_bin[i*3+2])
        pixels[x, y] = (r, g, b)

    # 2. Draw dynamic green dotted line around the randomly scattered payload
    start_y = start_pixel_index // width
    start_x = start_pixel_index % width
    end_pixel_index = start_pixel_index + pixels_needed - 1
    end_y = end_pixel_index // width
    end_x = end_pixel_index % width

    if start_y == end_y:
        box_left = start_x
        box_right = end_x
    else:
        box_left = min(start_x, end_x)
        box_right = max(start_x, end_x)
        # If it spans multiple entirely, stretch it
        if end_y > start_y + 1 or end_x < start_x:
            box_left = 0
            box_right = width - 1

    box_left = max(0, box_left - 5)
    box_top = max(0, start_y - 5)
    box_right = min(width - 1, box_right + 5)
    box_bottom = min(height - 1, end_y + 5)

    if box_right - box_left < 30:
        box_right = min(width - 1, box_left + 30)
    if box_bottom - box_top < 30:
        box_bottom = min(height - 1, box_top + 30)

    import colorsys

    # Calculate the average color of the bounding box area
    sum_r = sum_g = sum_b = 0
    count = 0
    for py in range(box_top, box_bottom + 1):
        for px in range(box_left, box_right + 1):
            r, g, b = pixels[px, py]
            sum_r += r; sum_g += g; sum_b += b
            count += 1
            
    avg_r, avg_g, avg_b = sum_r // count, sum_g // count, sum_b // count

    # Adjust the color to be "similar but visible"
    h, s, v = colorsys.rgb_to_hsv(avg_r / 255.0, avg_g / 255.0, avg_b / 255.0)

    # Boost saturation to make it pop, and flip brightness strictly for high contrast
    s = min(1.0, s + 0.5)
    if v > 0.5:
        v = max(0.0, v - 0.6)
    else:
        v = min(1.0, v + 0.6)

    # Convert back to RGB
    new_r, new_g, new_b = colorsys.hsv_to_rgb(h, s, v)
    box_color = (int(new_r * 255), int(new_g * 255), int(new_b * 255))

    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    for px in range(box_left, box_right + 1, 4):
        draw.point((px, box_top), fill=box_color)
        draw.point((px, box_bottom), fill=box_color)
    for py in range(box_top, box_bottom + 1, 4):
        draw.point((box_left, py), fill=box_color)
        draw.point((box_right, py), fill=box_color)

    # 3. Write the actual message starting exactly at the randomized index
    data_index = 0
    for i in range(start_pixel_index, start_pixel_index + pixels_needed):
        y = i // width
        x = i % width
        r, g, b = pixels[x, y]

        if data_index < len(binary_message):
            r = (r & ~1) | int(binary_message[data_index]); data_index += 1
        if data_index < len(binary_message):
            g = (g & ~1) | int(binary_message[data_index]); data_index += 1
        if data_index < len(binary_message):
            b = (b & ~1) | int(binary_message[data_index]); data_index += 1
            
        pixels[x, y] = (r, g, b)

    img.save(output_path, format='PNG')
    print("OK")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: encode_server.py <input> <message> <output>", file=sys.stderr)
        sys.exit(1)
    encode_image(sys.argv[1], sys.argv[2], sys.argv[3])

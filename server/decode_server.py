"""
decode_server.py — server-side decode script
Called by the Node route with args: <encoded_image>
Prints the hidden message to stdout.
Exits 0 on success, 1 on failure.
"""
import sys
from PIL import Image

def decode_image(image_path):
    try:
        img = Image.open(image_path).convert('RGB')
    except Exception as e:
        print(f"Cannot open image: {e}", file=sys.stderr)
        sys.exit(1)

    pixels = img.load()
    width, height = img.size
    
    # 1. Read the 24-bit header to find the exact pixel offset
    offset_bits = ""
    for i in range(8):
        y = i // width
        x = i % width
        r, g, b = pixels[x, y]
        offset_bits += str(r & 1) + str(g & 1) + str(b & 1)
        
    start_pixel_index = int(offset_bits[:24], 2)
    
    # Validate offset
    if start_pixel_index < 8 or start_pixel_index >= width * height:
        print("No valid header found or image is not encoded.", file=sys.stderr)
        sys.exit(1)

    # 2. Extract data starting strictly from the random start offset
    binary_data = ""
    total_pixels = width * height
    
    for i in range(start_pixel_index, total_pixels):
        y = i // width
        x = i % width
        r, g, b = pixels[x, y]
        binary_data += str(r & 1)
        binary_data += str(g & 1)
        binary_data += str(b & 1)
        
        # Periodically check for the delimiter to prevent reading the entire image unnecessarily
        if len(binary_data) % 600 == 0:
            idx = binary_data.find('1111111111111110')
            if idx != -1:
                binary_data = binary_data[:idx]
                break
    else:
        # Final check if loop finishes without hitting exact modulo
        idx = binary_data.find('1111111111111110')
        if idx != -1:
            binary_data = binary_data[:idx]

    # Group into bytes
    all_bytes = [binary_data[i:i+8] for i in range(0, len(binary_data), 8)]

    message = ""
    for byte in all_bytes:
        if len(byte) < 8:
            break
        try:
            message += chr(int(byte, 2))
        except Exception:
            break

    if not message:
        print("No hidden message found or image is not encoded.", file=sys.stderr)
        sys.exit(1)

    print(message, end="")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: decode_server.py <encoded_image>", file=sys.stderr)
        sys.exit(1)
    decode_image(sys.argv[1])

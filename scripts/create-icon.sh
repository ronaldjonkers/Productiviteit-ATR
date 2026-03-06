#!/bin/bash
# =============================================================================
# Generate a simple app icon for Productiviteit ATR
# Creates an .icns file from a programmatically generated icon
# =============================================================================

OUTPUT="${1:-app.icns}"
ICONSET_DIR="/tmp/ProductiviteitATR.iconset"

rm -rf "${ICONSET_DIR}"
mkdir -p "${ICONSET_DIR}"

# Generate icon using Python (available on all macOS)
python3 << 'PYEOF'
import struct, zlib, os

def create_png(width, height, filename):
    """Create a simple PNG icon with 'P' letter on blue gradient background."""
    pixels = []
    for y in range(height):
        row = []
        for x in range(width):
            # Blue gradient background
            r = int(30 + (x / width) * 30)
            g = int(60 + (y / height) * 70)
            b = int(200 + (x / width) * 55)

            # Draw rounded rectangle background
            margin = width * 0.08
            corner = width * 0.18
            in_rect = (margin <= x < width - margin and margin <= y < height - margin)

            # Check corners
            corners = [
                (margin + corner, margin + corner),
                (width - margin - corner, margin + corner),
                (margin + corner, height - margin - corner),
                (width - margin - corner, height - margin - corner),
            ]
            in_corner_cut = False
            for cx, cy in corners:
                dx = abs(x - cx)
                dy = abs(y - cy)
                if ((x < margin + corner or x > width - margin - corner) and
                    (y < margin + corner or y > height - margin - corner)):
                    if dx * dx + dy * dy > corner * corner:
                        in_corner_cut = True

            if not in_rect or in_corner_cut:
                r, g, b, a = 0, 0, 0, 0
            else:
                a = 255
                # "P" letter in white
                cx, cy = width / 2, height / 2
                lw = width * 0.08  # line width

                # Vertical bar of P
                in_p = False
                if (cx - width * 0.15 <= x <= cx - width * 0.15 + lw and
                    cy - height * 0.22 <= y <= cy + height * 0.22):
                    in_p = True

                # Top horizontal of P
                if (cx - width * 0.15 <= x <= cx + width * 0.12 and
                    cy - height * 0.22 <= y <= cy - height * 0.22 + lw):
                    in_p = True

                # Middle horizontal of P
                if (cx - width * 0.15 <= x <= cx + width * 0.12 and
                    cy - height * 0.02 <= y <= cy - height * 0.02 + lw):
                    in_p = True

                # Right curve of P (simplified as vertical bar)
                if (cx + width * 0.12 - lw <= x <= cx + width * 0.12 and
                    cy - height * 0.22 <= y <= cy - height * 0.02 + lw):
                    in_p = True

                if in_p:
                    r, g, b = 255, 255, 255

            row.extend([r, g, b, a])
        pixels.append(bytes(row))

    def write_png(f, w, h, rows):
        def chunk(ctype, data):
            c = ctype + data
            return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
        raw = b''
        for row in rows:
            raw += b'\x00' + row
        f.write(chunk(b'IDAT', zlib.compress(raw)))
        f.write(chunk(b'IEND', b''))

    with open(filename, 'wb') as f:
        write_png(f, width, height, pixels)

sizes = [16, 32, 64, 128, 256, 512]
iconset = '/tmp/ProductiviteitATR.iconset'
for s in sizes:
    create_png(s, s, f'{iconset}/icon_{s}x{s}.png')
    if s <= 256:
        create_png(s * 2, s * 2, f'{iconset}/icon_{s}x{s}@2x.png')

PYEOF

# Convert iconset to icns
iconutil -c icns "${ICONSET_DIR}" -o "${OUTPUT}" 2>/dev/null

if [ -f "${OUTPUT}" ]; then
    echo "✓ Icon created: ${OUTPUT}"
else
    echo "⚠ Icon creation failed (non-critical)"
fi

rm -rf "${ICONSET_DIR}"

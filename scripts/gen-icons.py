from PIL import Image, ImageDraw, ImageFont
import os, math

OUT = 'icons'
os.makedirs(OUT, exist_ok=True)

configs = [
    {'suffix': 'coach', 'char': '师', 'color': (79, 70, 229)},   # indigo
    {'suffix': 'student', 'char': '学', 'color': (5, 150, 105)},  # green
]

def create_icon(size, char, color):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Simpler approach: draw a circle/rounded square using ellipses
    pad = max(1, size // 12)
    cr = max(2, size // 4)  # corner radius

    # Background: use a filled ellipse for very small sizes
    if size <= 16:
        draw.ellipse([pad, pad, size-pad, size-pad], fill=color)
    else:
        # Rounded rectangle via composite shapes
        # Main body
        draw.rectangle([pad+cr, pad, size-pad-cr, size-pad], fill=color)
        draw.rectangle([pad, pad+cr, size-pad, size-pad-cr], fill=color)
        # Corners
        d = cr * 2
        draw.pieslice([pad, pad, pad+d, pad+d], 180, 270, fill=color)
        draw.pieslice([size-pad-d, pad, size-pad, pad+d], 270, 360, fill=color)
        draw.pieslice([pad, size-pad-d, pad+d, size-pad], 90, 180, fill=color)
        draw.pieslice([size-pad-d, size-pad-d, size-pad, size-pad], 0, 90, fill=color)

    # Highlight (top-left light reflection)
    if size >= 48:
        hl_alpha = 40
        hl_pad = pad + cr // 2
        hl = Image.new('RGBA', (size, size), (0,0,0,0))
        hd = ImageDraw.Draw(hl)
        h_cr = cr // 2
        h_x2 = size - pad - h_cr * 2
        h_y2 = int(size * 0.55)
        hd.rectangle([hl_pad+h_cr, hl_pad, h_x2, h_y2], fill=(255,255,255,hl_alpha))
        hd.rectangle([hl_pad, hl_pad+h_cr, h_x2+h_cr, h_y2-h_cr], fill=(255,255,255,hl_alpha))
        hd.pieslice([hl_pad, hl_pad, hl_pad+h_cr*2, hl_pad+h_cr*2], 180, 270, fill=(255,255,255,hl_alpha))
        hd.pieslice([h_x2-h_cr, hl_pad, h_x2+h_cr, hl_pad+h_cr*2], 270, 360, fill=(255,255,255,hl_alpha))
        img.paste(hl, (0,0), hl)

    # Character
    font_size = int(size * 0.52)
    try:
        for fp in ['/System/Library/Fonts/PingFang.ttc',
                    '/System/Library/Fonts/STHeiti Medium.ttc',
                    '/System/Library/Fonts/Hiragino Sans GB.ttc',
                    '/System/Library/Fonts/Supplemental/Songti.ttc']:
            if os.path.exists(fp):
                font = ImageFont.truetype(fp, font_size)
                break
        else:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    # Center text
    bbox = draw.textbbox((0, 0), char, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1] - size * 0.02

    # Shadow for depth
    if size >= 48:
        so = size * 0.03
        draw.text((tx+so, ty+so), char, fill=(0,0,0,30), font=font)
    draw.text((tx, ty), char, fill='white', font=font)

    return img

for cfg in configs:
    for size in [16, 48, 128]:
        icon = create_icon(size, cfg['char'], cfg['color'])
        fname = f"{OUT}/icon{size}_{cfg['suffix']}.png"
        icon.save(fname)
        print(f"  ✅ {fname} ({size}x{size})")

print("\nAll icons generated!")

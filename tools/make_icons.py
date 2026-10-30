"""Génère les icônes SuperEssence Sheets (fond noir, « S » blanc + « E. » jaune, mini-grille)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YELLOW = (255, 199, 44, 255)
FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']


def font(size):
    for f in FONTS:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def draw_icon(size, round_bg=True, pad_ratio=0.0, transparent=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not transparent:
        if round_bg:
            d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=(0, 0, 0, 255))
        else:
            d.rectangle([0, 0, size, size], fill=(0, 0, 0, 255))
    inner = size * (1 - 2 * pad_ratio)
    off = size * pad_ratio
    # grille tableur discrète
    g = inner * 0.62
    gx, gy = off + (inner - g) / 2, off + inner * 0.2
    for i in range(4):
        y = gy + g * i / 3
        d.line([gx, y, gx + g, y], fill=(255, 199, 44, 60) if transparent else (78, 62, 16, 255), width=max(1, int(size / 128)))
        x = gx + g * i / 3
        d.line([x, gy, x, gy + g], fill=(255, 199, 44, 60) if transparent else (78, 62, 16, 255), width=max(1, int(size / 128)))
    f = font(int(inner * 0.44))
    text_s, text_e, text_dot = 'S', 'E', '.'
    ws = d.textlength(text_s, font=f)
    we = d.textlength(text_e, font=f)
    wd = d.textlength(text_dot, font=f)
    total = ws + we + wd
    x = off + (inner - total) / 2
    bbox = f.getbbox('SE')
    th = bbox[3] - bbox[1]
    y = off + (inner - th) / 2 - bbox[1] - inner * 0.02
    sh = max(2, int(size * 0.025))
    for t, col, dx in ((text_s, (255, 255, 255, 255), 0), (text_e, YELLOW, ws), (text_dot, YELLOW, ws + we)):
        d.text((x + dx + sh, y + sh), t, font=f, fill=(60, 60, 60, 255))
        d.text((x + dx, y), t, font=f, fill=col)
    # barre de progression jaune (clin d'œil sport)
    bw = inner * 0.5
    bx = off + (inner - bw) / 2
    by = off + inner * 0.8
    d.rounded_rectangle([bx, by, bx + bw, by + inner * 0.045], radius=int(inner * 0.03), fill=YELLOW)
    return img


def main():
    www = os.path.join(ROOT, 'www', 'img')
    os.makedirs(www, exist_ok=True)
    draw_icon(192).save(os.path.join(www, 'icon-192.png'))
    draw_icon(512).save(os.path.join(www, 'icon-512.png'))
    draw_icon(1024, round_bg=False).save(os.path.join(ROOT, 'resources', 'icon.png')) if os.path.isdir(os.path.join(ROOT, 'resources')) else None
    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(res):
        print('android/ absent : icônes web uniquement')
        return
    sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    fg_sizes = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for k, s in sizes.items():
        dst = os.path.join(res, 'mipmap-' + k)
        os.makedirs(dst, exist_ok=True)
        draw_icon(s).save(os.path.join(dst, 'ic_launcher.png'))
        draw_icon(s).save(os.path.join(dst, 'ic_launcher_round.png'))
        draw_icon(fg_sizes[k], round_bg=False, pad_ratio=0.18, transparent=True).save(os.path.join(dst, 'ic_launcher_foreground.png'))
    # écrans de démarrage
    for name in os.listdir(res):
        if name.startswith('drawable') and os.path.exists(os.path.join(res, name, 'splash.png')):
            p = os.path.join(res, name, 'splash.png')
            w, h = Image.open(p).size
            img = Image.new('RGBA', (w, h), (0, 0, 0, 255))
            logo = draw_icon(int(min(w, h) * 0.38), transparent=True)
            img.paste(logo, ((w - logo.width) // 2, (h - logo.height) // 2), logo)
            img.convert('RGB').save(p)
    print('icônes Android générées')


if __name__ == '__main__':
    sys.exit(main())

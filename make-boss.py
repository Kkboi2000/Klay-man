"""Draws boss.png: the boss bacteria, four times a bacteria, on the same pixel
grid as every other sprite (so its pixels match Klayman's when drawn 2x).

A row of 96 x 72 frames: four of it fighting (its cilia wave, it breathes),
then two worn out (drooping eyes, panting, sweating). Its feet are at (48, 64)
in every frame. Colours are the bacteria's own, a shade darker.

Run:  python3 make-boss.py   (needs Pillow: pip install pillow)
"""
import math
from PIL import Image

W, H = 96, 72
FOOT = (48, 64)
CX, CY = 48, 41          # middle of the body
RX, RY = 29, 21          # the body, across and up

# The bacteria's palette (bacteiras.png), a shade darker for the boss.
OUTLINE = (12, 40, 16)
TONES = [(22, 60, 36), (32, 78, 48), (42, 96, 60), (52, 114, 72), (64, 132, 84)]  # dark to light
SPOT = (30, 72, 44)
SPOT_LIGHT = (76, 150, 98)
EYE = (0, 0, 0)
SHINE = (150, 176, 158)
BROW = (8, 28, 10)
MOUTH = (96, 68, 14)
MOUTH_DEEP = (52, 34, 6)
TOOTH = (226, 214, 168)
SWEAT = (143, 227, 255)
SWEAT_LIGHT = (212, 240, 255)

# Ordered dither, so the shading steps blend in pixel-art fashion.
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def body_at(x, y, breathe):
    """Inside the body? A rounded box like the bacteria's, flat where it sits."""
    ry = RY + breathe
    cy = CY - breathe
    if y > FOOT[1] - 2:
        return None
    nx = (x + 0.5 - CX) / RX
    ny = (y + 0.5 - cy) / ry
    d = abs(nx) ** 2.5 + abs(ny) ** 2.5
    return (nx, ny, min(1.0, nx * nx + ny * ny)) if d <= 1 else None


def tone(nx, ny, d, x, y):
    """Lit from the upper left; darker toward the belly, like the bacteria."""
    nz = math.sqrt(max(0.0, 1 - d))
    light = (-0.45 * nx - 0.65 * ny + 0.62 * nz)
    belly = max(0.0, ny - 0.3) * 0.9
    v = light - belly                      # about -1 .. 1
    v = (v + 0.55) / 1.25 * (len(TONES) - 1)
    v += (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.7
    return TONES[max(0, min(len(TONES) - 1, int(round(v))))]


def put(img, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < H:
        if a >= 255:
            img.putpixel((x, y), (*c, 255))
        else:
            r, g, b, a0 = img.getpixel((x, y))
            if a0 == 0:
                img.putpixel((x, y), (*c, a))
            else:
                k = a / 255
                img.putpixel((x, y), (round(r + (c[0] - r) * k), round(g + (c[1] - g) * k), round(b + (c[2] - b) * k), max(a0, a)))


LEG = (30, 86, 38)
LEG_DARK = (16, 52, 22)


def line(img, x0, y0, x1, y1, c, width=1, fade=False):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(n + 1):
        k = i / n
        x = x0 + (x1 - x0) * k
        y = y0 + (y1 - y0) * k
        a = int(255 * (1 - k * 0.85)) if fade else 255
        for w in range(width):
            put(img, int(round(x)), int(round(y)) + w, c, a)


def cilia(img, phase, breathe):
    """Its legs (four a side, jointed, waving) and fine hairs on top: drawn
    first, so the body covers their roots."""
    for side in (-1, 1):
        for j, (hy, up) in enumerate([(-12, -0.9), (-4, -0.35), (4, 0.25), (12, 0.8)]):
            wave = math.sin(phase + j * 1.7 + (0 if side < 0 else 1.1)) * 1.6
            root = (CX + side * (RX - 3), CY - breathe + hy)
            knee = (root[0] + side * 9, root[1] + up * 6 - 3 + wave)
            foot = (knee[0] + side * 6, knee[1] + 7 + abs(up) * 2 - wave * 0.5)
            line(img, *root, *knee, LEG_DARK, 3)
            line(img, *knee, *foot, LEG_DARK, 3)
            line(img, *root, *knee, LEG, 2)
            line(img, *knee, *foot, LEG, 2)
            # A few bristles off each leg, soft at the tips.
            line(img, *foot, foot[0] + side * 3, foot[1] + 2, LEG, 1, fade=True)
    for i in range(9):
        a = math.pi * (1.22 + 0.56 * i / 8)
        wave = math.sin(phase * 1.3 + i) * 0.25
        root = (CX + math.cos(a) * (RX - 4), CY - breathe + math.sin(a) * (RY + breathe - 1))
        tip = (root[0] + math.cos(a + wave) * 7, root[1] + math.sin(a + wave) * 7)
        line(img, *root, *tip, LEG, 1, fade=True)


def outline(img):
    """A dark line round everything solid, as in the original art."""
    solid = [[img.getpixel((x, y))[3] == 255 for x in range(W)] for y in range(H)]
    for y in range(H):
        for x in range(W):
            if solid[y][x]:
                continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and solid[y + dy][x + dx] and img.getpixel((x + dx, y + dy))[:3] != OUTLINE
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                put(img, x, y, OUTLINE)


def disc(img, cx, cy, r, c, ry=None):
    ry = ry or r
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if ((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                put(img, x, y, c)


def spots(img, breathe):
    """Organelles under the skin: a few dark blobs with a lit rim."""
    for (sx, sy, r) in [(-19, -8, 3.2), (20, -10, 2.6), (-23, 6, 2.2), (24, 5, 2.8), (-6, -16, 2.0), (11, -16, 1.6), (15, 13, 1.8)]:
        cx, cy = CX + sx, CY - breathe + sy
        disc(img, cx, cy, r, SPOT)
        put(img, int(cx - r * 0.5), int(cy - r * 0.6), SPOT_LIGHT)
    # A shine on its crown.
    for (dx, dy) in [(-13, -15), (-12, -15), (-11, -16), (-14, -14), (-10, -16), (-9, -17)]:
        put(img, CX + dx, CY - breathe + dy, (98, 172, 118))


def face(img, breathe, tired, phase):
    ey = CY - breathe - 2
    for side in (-1, 1):
        ex = CX + side * 10
        if tired:
            # Drooping lids: half-shut eyes, looking down.
            disc(img, ex, ey + 2, 3.4, EYE, 2.6)
            for x in range(ex - 4, ex + 5):
                put(img, x, ey, TONES[3])
                put(img, x, ey + 1, OUTLINE if abs(x - ex) < 4 else TONES[3])
            put(img, ex - side, ey + 3, SHINE)
            # Brows sag outward.
            for t in range(7):
                put(img, ex - side * 3 + side * t, ey - 4 + t // 3, BROW)
        else:
            disc(img, ex, ey, 3.6, EYE, 4.4)
            put(img, ex - 1, ey - 2, SHINE)
            put(img, ex - 2, ey - 2, SHINE)
            put(img, ex - 1, ey - 1, SHINE)
            put(img, ex + 1, ey + 2, (70, 90, 76))
            # Angry brows, slanting down toward the middle.
            for t in range(8):
                bx = ex + side * 4 - side * t
                by = ey - 8 + t // 2
                put(img, bx, by, BROW)
                put(img, bx, by + 1, BROW)
    my = CY - breathe + 9
    if tired:
        # Panting: a round open mouth.
        disc(img, CX, my + 1, 4.2, MOUTH_DEEP, 3.4 + (phase % 2) * 0.8)
        disc(img, CX, my + 2, 2.4, MOUTH, 1.4)
    else:
        # A wide grin with a row of teeth.
        for x in range(CX - 11, CX + 12):
            k = abs(x - CX) / 11
            top = my - int(1 - k)
            bottom = my + int(4 * (1 - k * k)) + 1
            for y in range(top, bottom + 1):
                put(img, x, y, MOUTH_DEEP if y > top + 1 else MOUTH)
        for x in range(CX - 9, CX + 10, 3):
            put(img, x, my, TOOTH)
            put(img, x + 1, my, TOOTH)
            put(img, x, my + 1, TOOTH)
        for x in range(CX - 12, CX + 13):          # its lip line
            k = abs(x - CX) / 12
            put(img, x, my - 1 - int(1 - k), OUTLINE)


def sweat(img, phase):
    for (dx, dy) in [(-22, -14), (21, -12)]:
        x = CX + dx
        y = CY + dy + (phase % 2) * 2
        for (ox, oy, c) in [(0, 0, SWEAT_LIGHT), (0, 1, SWEAT), (-1, 1, SWEAT), (1, 1, SWEAT), (0, 2, SWEAT), (-1, 2, SWEAT), (1, 2, SWEAT), (0, 3, SWEAT)]:
            put(img, x + ox, y + oy, c)
        for (ox, oy) in [(0, -1), (-1, 0), (1, 0), (-2, 1), (2, 1), (-2, 2), (2, 2), (-1, 3), (1, 3), (0, 4)]:
            put(img, x + ox, y + oy, OUTLINE)


def frame(phase, breathe, tired=False):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cilia(img, phase, breathe)
    for y in range(H):
        for x in range(W):
            b = body_at(x, y, breathe)
            if b:
                put(img, x, y, tone(*b, x, y))
    spots(img, breathe)
    outline(img)
    face(img, breathe, tired, int(phase))
    if tired:
        sweat(img, int(phase))
        # Worn out: a duller, darker skin.
        for y in range(H):
            for x in range(W):
                r, g, b, a = img.getpixel((x, y))
                if a and (r, g, b) not in (SWEAT, SWEAT_LIGHT, OUTLINE):
                    grey = (r + g + b) // 3
                    img.putpixel((x, y), (int(r * 0.6 + grey * 0.4 * 0.9), int(g * 0.6 + grey * 0.4 * 0.9), int(b * 0.6 + grey * 0.4 * 0.9), a))
    return img


def main():
    frames = [frame(p * math.pi / 2, b) for p, b in zip(range(4), (0, 1, 1, 0))]
    frames += [frame(0, -1, tired=True), frame(1, -1, tired=True)]
    sheet = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0))
    sheet.save('boss.png', optimize=True)
    print('boss.png:', sheet.size)


if __name__ == '__main__':
    main()

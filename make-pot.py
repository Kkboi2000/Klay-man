# Draws bg.png: the flowerpot seen from straight above, a perfect circle.
# (Until v21 it was seen at an angle, so it looked like an oval.)
#
#   pip install pillow
#   python make-pot.py
#
# The game blows this picture up by POT_SCALE (config.js). If you change the
# sizes below, change world.js to match: SIZE is WORLD, SOIL_R is SOIL's
# radius, and HOLE is TREE_SPOT (all before POT_SCALE).
from PIL import Image

SIZE = 560                       # the picture is SIZE x SIZE
C = SIZE / 2                     # the pot's middle
SOIL_R = 171                     # the soil: as much of it as the old oval had
RIM_R = 213                      # the clay rim round it
HOLE = (C - 5, C + 12)           # where the sprout grows

GROUND = (0x63, 0x63, 0x63)      # the gray around the pot
SHADE = (0x57, 0x57, 0x57)       # the pot's shadow on it
RIM = (0xb8, 0x64, 0x20)
RIM_EDGE = (0x90, 0x4e, 0x19)    # the rim's outer edge
LIP = (0x70, 0x45, 0x23)         # where the rim meets the soil
SOIL = (0x24, 0x19, 0x0d)
SOIL_SHADE = (0x1d, 0x14, 0x09)  # the rim's shadow on the soil
DARK = (0x17, 0x0d, 0x06)        # scratches and the hole

# Little scratches in the soil, as in the old picture, and where they go.
SCRATCH = [
    '........................xxxxxxx....................................',
    '...............................xxx.................................',
    '...................................................................',
    '...................................................................',
    '...................................................................',
    '...................................................................',
    '.........x.........................................................',
    '.......xx.xx.............................................xx........',
    '....xxx.....xx........................................xxx..x.......',
    'xxxx..........xx...................................xxx......x......',
    '............................................................xx.....',
    '.............................xxx..............................xxxxx',
    '...........................xx......................................',
    '..........................x........................................',
    '...................................................................',
    '...................................................................',
    '...................................................................',
    '...........................................xxx.....................',
    '..............xxx........................xx...x....................',
    '..............x..x.......................x.....xx..................',
    '..................xx...................xx..........................',
    '....................x..............................................',
]
# Each patch's middle, from the pot's middle (the old oval's spots, made round).
PATCHES = [(-41, -121), (44, -77), (-102, -63), (-29, -63), (111, -19),
           (-62, -10), (-124, 45), (57, 47), (-25, 73), (57, 116),
           (115, 62), (-95, 108), (-100, -120)]

# The hole the sprout grows in: the old one, a little rounder from above.
HOLE_ROWS = [
    '......................x.................................',
    '................xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..........',
    '..............xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx........',
    '.............xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.......',
    '...........xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.......',
    '...........xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.......',
    '.........xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx......',
    '...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..',
    '.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx....',
    '.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx......',
    '.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.......',
    '.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.........',
    '...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..........',
    '.....xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...........',
    '........xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.............',
    '...............xxxxxxxxxxxxxxxxxxxxxxxxxxx..............',
    '.....................xxxxxxxxx..........................',
]
HOLE_STRETCH = 2                 # each row twice: round from above


def dist(x, y, cx, cy):
    return ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5


def main():
    img = Image.new('RGB', (SIZE, SIZE), GROUND)
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            d = dist(x, y, C, C)
            if d > RIM_R:
                # The pot's shadow falls down and to the right.
                if dist(x, y, C + 6, C + 10) <= RIM_R:
                    px[x, y] = SHADE
                continue
            if d > SOIL_R + 3:
                px[x, y] = RIM_EDGE if d > RIM_R - 3 else RIM
            elif d > SOIL_R:
                px[x, y] = LIP
            else:
                # The rim shades the soil along its top-left edge.
                px[x, y] = SOIL_SHADE if dist(x, y, C + 7, C + 9) > SOIL_R else SOIL

    def stamp(rows, cx, cy, repeat=1, flip=False):
        h = len(rows) * repeat
        w = len(rows[0])
        for j in range(h):
            row = rows[j // repeat]
            for i in range(w):
                if row[w - 1 - i if flip else i] != 'x':
                    continue
                x = round(cx - w / 2 + i)
                y = round(cy - h / 2 + j)
                if dist(x, y, C, C) <= SOIL_R - 4:
                    px[x, y] = DARK

    for n, (dx, dy) in enumerate(PATCHES):
        stamp(SCRATCH, C + dx, C + dy, flip=n % 2 == 1)
    stamp(HOLE_ROWS, HOLE[0], HOLE[1], repeat=HOLE_STRETCH)
    img.save('bg.png')
    print(f'bg.png: {SIZE}x{SIZE}, soil radius {SOIL_R}, sprout at {HOLE}')


if __name__ == '__main__':
    main()

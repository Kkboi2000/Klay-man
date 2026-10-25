# Builds klay-digits.woff2 and klay-digits-bold.woff2: the numbers 0-9 the game
# uses instead of Pixelify Sans's, whose 2 and 5 read as 8 and S at small
# sizes. Letters still come from Pixelify Sans; style.css takes only digits
# from these files. Drawn on Pixelify's own 5 x 7 pixel grid, so they match.
#
# Edit a digit below, then run:  pip install fonttools brotli && python3 make-digits.py
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

REGULAR = {  # 1-pixel strokes, for normal text
    '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
}

BOLD = {  # 2-pixel stems, so the holes stay open in bold
    '0': ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
    '1': ['.##..', '###..', '.##..', '.##..', '.##..', '.##..', '####.'],
    '2': ['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####'],
    '3': ['####.', '...##', '...##', '.###.', '...##', '...##', '####.'],
    '4': ['...##', '..###', '.#.##', '##.##', '#####', '...##', '...##'],
    '5': ['#####', '##...', '####.', '...##', '...##', '##.##', '.###.'],
    '6': ['..##.', '.##..', '##...', '####.', '##.##', '##.##', '.###.'],
    '7': ['#####', '...##', '..##.', '..##.', '.##..', '.##..', '.##..'],
    '8': ['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '.###.'],
    '9': ['.###.', '##.##', '##.##', '.####', '...##', '..##.', '.##..'],
}

NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
PIXEL = 92          # Pixelify Sans: 1000 units per em, 5 x 7 digits about 92 units a pixel
LEFT = 60           # same left edge and baseline as Pixelify's digits
BOTTOM = -12
SEAM = 2            # rows overlap a hair so no thin line shows between them


def glyph(rows):
    pen = TTGlyphPen(None)
    for r, row in enumerate(rows):
        y0 = BOTTOM + (len(rows) - 1 - r) * PIXEL
        y1 = y0 + PIXEL + (SEAM if r else 0)
        c = 0
        while c < len(row):
            if row[c] != '#':
                c += 1
                continue
            start = c
            while c < len(row) and row[c] == '#':
                c += 1
            x0, x1 = LEFT + start * PIXEL, LEFT + c * PIXEL
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0))
            pen.closePath()
    g = pen.glyph()
    g.flags[0] |= 0x40  # contours overlap on purpose
    return g


def build(art, style, weight, advance, path):
    fb = FontBuilder(1000, isTTF=True)
    order = ['.notdef'] + NAMES
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({ord(str(i)): NAMES[i] for i in range(10)})
    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    glyphs.update({NAMES[i]: glyph(art[str(i)]) for i in range(10)})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (advance, LEFT if n != '.notdef' else 0) for n in order})
    # Same line metrics as Pixelify Sans, so mixing the two never shifts a line.
    fb.setupHorizontalHeader(ascent=920, descent=-280)
    fb.setupNameTable({'familyName': 'Klay Digits', 'styleName': style})
    fb.setupOS2(sTypoAscender=920, sTypoDescender=-280, sTypoLineGap=0, usWinAscent=922, usWinDescent=289,
                usWeightClass=weight, sCapHeight=632, sxHeight=450)
    fb.setupPost()
    fb.font.flavor = 'woff2'
    fb.save(path)


build(REGULAR, 'Regular', 400, 586, 'klay-digits.woff2')
build(BOLD, 'Bold', 700, 603, 'klay-digits-bold.woff2')
print('wrote klay-digits.woff2 and klay-digits-bold.woff2')

# Builds the app icons from icon.png, the icon's own 18 x 18 pixels: each
# size is a whole number of screen pixels per art pixel (so it stays crisp),
# centred on the icon's brown. Edit icon.png and run:  python3 make-icon.py
# (pip install pillow)
from PIL import Image

ART = Image.open('icon.png').convert('RGB')
BROWN = ART.getpixel((0, 0))               # the icon's own background

def icon(size, scale):
    """The art at `scale` pixels per art pixel, centred on a `size` square."""
    big = ART.resize((ART.width * scale, ART.height * scale), Image.NEAREST)
    out = Image.new('RGB', (size, size), BROWN)
    out.paste(big, ((size - big.width) // 2, (size - big.height) // 2))
    return out

# name: (size, pixels per art pixel). The maskable icon is smaller inside its
# square: Android may crop it to a circle 80% across, and the face must fit.
SIZES = {
    'favicon-48.png': (48, 2),
    'apple-touch-icon.png': (180, 10),
    'icon-192.png': (192, 10),
    'icon-512.png': (512, 28),
    'icon-maskable-512.png': (512, 22),
}
for name, (size, scale) in SIZES.items():
    icon(size, scale).save(name, optimize=True)
    print(name, size)

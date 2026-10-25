// Loads the sprite sheets and describes where each animation lives on them.

/** In the single-file preview build, assets arrive inline as data URLs. */
export function assetUrl(path) {
  const inline = globalThis.KLAYMAN_ASSETS;
  return (inline && inline[path]) || path;
}

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${path}`));
    img.src = assetUrl(path);
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A copy of an image washed with a colour (poison green, frozen blue...). */
function tinted(img, color) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Turns rows of characters into a tiny pixel-art canvas. */
export function pixelArt(rows, palette) {
  const c = makeCanvas(rows[0].length, rows.length);
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    });
  });
  return c;
}

// --- Klayman: 6 x 10 grid of 48px frames ------------------------------------
// rows 0-2 idle (front, side, back), 3-5 walk, 6-8 action (cols 0-2 throw,
// cols 3-5 push), row 9 col 3 is the dirt shot.
const FACING_ROW = { front: 0, side: 1, back: 2 };

export const KLAY = {
  size: 48,
  anchor: { x: 24, y: 41 },
  frame(kind, facing, t, actionT = 0) {
    const r = FACING_ROW[facing];
    if (kind === 'idle') return { col: Math.floor(t * 6) % 6, row: r };
    if (kind === 'walk') return { col: Math.floor(t * 10) % 6, row: 3 + r };
    const col = Math.min(2, Math.floor(actionT * 15));
    return { col: kind === 'push' ? 3 + col : col, row: 6 + r };
  },
  shot: { x: 3 * 48 + 20, y: 9 * 48 + 32, w: 6, h: 6 },
};

// --- Bacteria sheet: 32px frames ---------------------------------------------
// rows 0-3: crawl with 0-3 layers of dirt (4 frames), row 4: dirtball,
// then the green splat and the dirtball break (5 frames each).
export const BAC = {
  size: 32,
  anchor: { x: 16, y: 23 },
  crawlY: (look) => look * 32,
  ballY: 128,
  splatY: 183,
  ballBreakY: 219,
};

// --- Sprout: two 32x48 frames, gently swaying --------------------------------
export const TREE_ART = { w: 32, h: 48, anchor: { x: 16, y: 35 } };

// --- Item icons (16x16) -------------------------------------------------------
const ICON_ROWS = {
  plus: [
    '................',
    '.....kkkkkk.....',
    '.....khhrrk.....',
    '.....khrrrk.....',
    '.....krrrrk.....',
    '.kkkkkrrrrkkkkk.',
    '.khhrrrrrrrrrrk.',
    '.khrrrrrrrrrrrk.',
    '.krrrrrrrrrrrrk.',
    '.krrrrrrrrrrrdk.',
    '.kkkkkrrrrkkkkk.',
    '.....krrrrk.....',
    '.....krrrrk.....',
    '.....krrrdk.....',
    '.....kkkkkk.....',
    '................',
  ],
  bag: [
    '................',
    '.....o.oo.o.....',
    '....olobbolo....',
    '.....obbbbo.....',
    '......otto......',
    '.....oottoo.....',
    '....obbbbbbo....',
    '...obllbbbbbo...',
    '..oblbbggbbbbso.',
    '..obbbgggbbbbso.',
    '..obbbbgbbbbbso.',
    '..obbbbgbbbbsso.',
    '..osbbbbbbbssso.',
    '...ossssssssso..',
    '....ooooooooo...',
    '................',
  ],
  water: [
    '................',
    '.......oo.......',
    '......owwo......',
    '......owwo......',
    '.....owwwwo.....',
    '.....owwwwo.....',
    '....owwwwwwo....',
    '...owlwwwwwwo...',
    '...owlwwwwwwo...',
    '..owllwwwwwwwo..',
    '..owlwwwwwwwdo..',
    '..owwwwwwwwwdo..',
    '...owwwwwwwdo...',
    '....owwwwddo....',
    '.....oooooo.....',
    '................',
  ],
  sandclock: [
    '................',
    '..ffffffffffff..',
    '...oggggggggo...',
    '...ogssssssgo...',
    '....ogssssgo....',
    '.....ogssgo.....',
    '......ogso......',
    '.......so.......',
    '......ogso......',
    '.....oggsgo.....',
    '....oggssggo....',
    '...oggssssggo...',
    '...osssssssso...',
    '..ffffffffffff..',
    '................',
    '................',
  ],
};

const ICON_PALETTE = {
  k: '#3a1010', r: '#d9483b', h: '#ff9a8a', d: '#9e2a22',
  o: '#2b1a0c', b: '#c9a46a', l: '#ead09a', s: '#a07c45', t: '#6e3c13', g: '#6aa84f',
  w: '#4aa3df', f: '#8a5a2b',
};
const PALETTE_BY_ICON = {
  water: { ...ICON_PALETTE, l: '#d4f0ff', d: '#2a6fa8', o: '#123a5c' },
  sandclock: { ...ICON_PALETTE, g: '#cfe7ef', s: '#e8c060' },
};

const HEART_ROWS = [
  '.kk...kk.',
  'khrk.krrk',
  'khrrkrrrk',
  'krrrrrrrk',
  '.krrrrrk.',
  '..krrrk..',
  '...krk...',
  '....k....',
];

export function heartArt(full) {
  const pal = full
    ? { k: '#2b0d0d', r: '#d9483b', h: '#ff9a8a' }
    : { k: '#2b0d0d', r: 'rgba(36,25,13,0.55)', h: 'rgba(36,25,13,0.55)' };
  return pixelArt(HEART_ROWS, pal);
}

export function iconArt(name) {
  return pixelArt(ICON_ROWS[name], PALETTE_BY_ICON[name] || ICON_PALETTE);
}

export async function loadSprites() {
  const [bg, klay, bac, tree] = await Promise.all([
    loadImage('assets/bg.png'),
    loadImage('assets/klay.png'),
    loadImage('assets/bacteiras.png'),
    loadImage('assets/tree.png'),
  ]);
  return {
    bg,
    klay,
    klayGreen: tinted(klay, 'rgba(96, 196, 72, 0.55)'),
    bac,
    bacFrozen: tinted(bac, 'rgba(150, 215, 255, 0.55)'),
    tree,
    treeHurt: tinted(tree, 'rgba(255, 70, 50, 0.7)'),
    treeWilted: tinted(tree, 'rgba(70, 45, 20, 0.85)'),
    heart: heartArt(true),
    icons: {
      plus: iconArt('plus'),
      bag: iconArt('bag'),
      water: iconArt('water'),
      sandclock: iconArt('sandclock'),
    },
  };
}

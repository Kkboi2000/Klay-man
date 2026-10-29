// Loads the sprite sheets and describes where each animation lives on them.
// Also dresses Klayman in his tools and builds the bought sprouts, coins,
// icons and gadget props from the pixel art in art.js.
import {
  SPROUT_PALETTE, SPROUT_ROWS, CLOSING_ROWS, SPROUT_SWAY, ART_PALETTE, TOOL_ICON_ROWS, SHOP_ICON_ROWS,
  GADGET_ICON_ROWS, COIN_ROWS, GUN_ART, GUN_ART_SMALL, PACK_ART, LEAF_ROWS, BOTTLE_ROWS, SHOVEL_ROWS, SHOVEL_GRIP,
} from './art.js';

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

/** A grey copy of an image: its colours drained, its shading kept. */
function greyed(img) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = 'hsl(0, 0%, 50%)';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';   // back to the image's own shape
  g.drawImage(img, 0, 0);
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

/** Turns rows of characters into a tiny pixel-art canvas, `height` tall. */
export function pixelArt(rows, palette, height = rows.length) {
  const c = makeCanvas(rows[0].length, height);
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

// --- Boss: 96x72 frames from make-boss.py --------------------------------------
// Frames 0-3 fighting (legs waving, breathing), 4-5 worn out. Feet at (48, 64).
export const BOSS_ART = { w: 96, h: 72, anchor: { x: 48, y: 64 }, fight: [0, 1, 2, 3], tired: [4, 5], top: 51 };

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

/** A heart: 'full', 'half' (the left half filled) or 'empty'. */
export function heartArt(kind) {
  const full = { k: '#2b0d0d', r: '#d9483b', h: '#ff9a8a' };
  const empty = { k: '#2b0d0d', r: 'rgba(36,25,13,0.55)', h: 'rgba(36,25,13,0.55)' };
  if (kind !== 'half') return pixelArt(HEART_ROWS, kind === 'full' ? full : empty);
  const mid = Math.floor(HEART_ROWS[0].length / 2);
  const left = HEART_ROWS.map((row) => [...row].map((ch, x) => (x <= mid ? ch : '.')).join(''));
  const right = HEART_ROWS.map((row) => [...row].map((ch, x) => (x > mid ? ch : '.')).join(''));
  const c = pixelArt(right, empty);
  c.getContext('2d').drawImage(pixelArt(left, full), 0, 0);
  return c;
}

export function iconArt(name) {
  return pixelArt(ICON_ROWS[name], PALETTE_BY_ICON[name] || ICON_PALETTE);
}

// --- Klayman's tools ------------------------------------------------------------
// Rather than a sheet per tool, each sheet is recoloured from klay.png, so
// shoes, gloves and coat follow every frame of every animation. The art uses
// a few colour roles; the eyes tell face skin (around them) from hands.

const ROLE = { empty: 0, outline: 1, shadow: 2, eye: 3, letter: 4, skin: 5, shirt: 6, dark: 7 };

function roleOf(r, g, b, a) {
  if (a === 0) return ROLE.empty;
  const lum = r + g + b;
  if (lum < 12) return ROLE.outline;
  if (b > r) return ROLE.shadow;
  if (lum >= 600) return ROLE.eye;
  if (r === 186 && g === 171 && b === 159) return ROLE.letter;
  if (lum >= 380) return ROLE.skin;
  if (Math.abs(r - 117) < 4 && Math.abs(g - 86) < 4) return ROLE.shirt;
  return ROLE.dark;
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Groups touching pixels of one role; marks each group that sits next to an eye. */
function groups(roles, role, size) {
  const seen = new Uint8Array(size * size);
  const out = [];
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] !== role || seen[i]) continue;
    const px = [];
    let byEye = false;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      const x = j % size;
      const y = (j - x) / size;
      px.push(j);
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && roles[ny * size + nx] === ROLE.eye) byEye = true;
      }
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const k = ny * size + nx;
        if (!seen[k] && roles[k] === role) { seen[k] = 1; stack.push(k); }
      }
    }
    out.push({ px, byEye });
  }
  return out;
}

/** For one 48px frame: which pixels are hands, shirt, feet and eyes. */
function readFrame(img, fx, fy) {
  const size = KLAY.size;
  const roles = new Uint8Array(size * size);
  const lum = new Uint16Array(size * size);
  let bottom = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = ((fy + y) * img.width + fx + x) * 4;
      const d = img.data;
      const role = roleOf(d[i], d[i + 1], d[i + 2], d[i + 3]);
      roles[y * size + x] = role;
      lum[y * size + x] = d[i] + d[i + 1] + d[i + 2];
      if (role >= ROLE.letter && y > bottom) bottom = y;
    }
  }
  const hands = groups(roles, ROLE.skin, size).filter((g) => !g.byEye);
  const shirt = groups(roles, ROLE.shirt, size).filter((g) => !g.byEye).flatMap((g) => g.px);
  roles.forEach((r, i) => { if (r === ROLE.letter) shirt.push(i); });
  // Feet: the bottom row, plus the dark pixel just above each (so shoes
  // are two pixels tall), with a sole drawn into the shadow below.
  const feet = [];
  const soles = [];
  for (let x = 0; x < size; x++) {
    const i = bottom * size + x;
    if (roles[i] !== ROLE.dark && roles[i] !== ROLE.shirt) continue;
    feet.push(i);
    if (roles[i - size] === ROLE.dark) feet.push(i - size);
    const below = i + size;
    if (bottom + 1 < size && roles[below] !== ROLE.dark) soles.push(below);
  }
  const handSpots = hands.map((g) => {
    const xs = g.px.map((i) => i % size);
    const ys = g.px.map((i) => Math.floor(i / size));
    return { x: Math.max(...xs), y: Math.round(ys.reduce((a, b) => a + b, 0) / ys.length) };
  });
  const eyes = [];
  roles.forEach((r, i) => { if (r === ROLE.eye) eyes.push(i); });
  const shirtBox = shirt.length ? {
    x0: Math.min(...shirt.map((i) => i % size)),
    x1: Math.max(...shirt.map((i) => i % size)),
    y0: Math.min(...shirt.map((i) => Math.floor(i / size))),
  } : null;
  return { hands: hands.flatMap((g) => g.px), handSpots, shirt, shirtBox, feet, soles, eyes, roles, lum };
}

const DRESS = {
  shoes: { feet: ['#d9483b', '#d9483b'], soles: '#fff4e3' },
  gloves: { hands: ['#f6b545', '#c98420'] },
  coat: { shirt: ['#eef2f5', '#9fb4c4'] },
  glasses: { lens: '#7fd8f5', shine: '#e6fbff', strap: '#1f5873' },
};
// The tools painted onto him. The gun is drawn in his hand instead.
const DRESSABLE = Object.keys(DRESS);

/** Digital glasses: a light blue screen across his eyes, from one eye to
 *  the other and a pixel past each. From behind, the strap. */
function glassesOn(f, back) {
  const size = KLAY.size;
  const out = [];
  if (back) {
    // Seen from behind: a strap across the hair, at the eyes' height.
    if (back.eyeY === null) return out;
    for (let x = 0; x < size; x++) {
      const i = back.eyeY * size + x;
      if (f.roles[i] === ROLE.dark) out.push([i, 'strap']);
    }
    return out;
  }
  if (!f.eyes.length) return out;
  const xs = f.eyes.map((i) => i % size);
  const ys = f.eyes.map((i) => Math.floor(i / size));
  const [x0, x1] = [Math.min(...xs) - 1, Math.max(...xs) + 1];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * size + x;
      const r = f.roles[i];
      if (r === ROLE.empty || r === ROLE.outline) continue;
      out.push([i, r === ROLE.eye && y === y0 ? 'shine' : 'lens']);
    }
  }
  return out;
}

/** Where his eyes sit in a front-facing frame, so the back frames get a strap. */
function eyeRow(f) {
  if (!f.eyes.length) return null;
  return Math.min(...f.eyes.map((i) => Math.floor(i / KLAY.size)));
}

function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }

/** Reads every frame once: where his hands, shirt and feet are. */
function readKlay(img) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, img.width, img.height);
  const frames = [];
  for (let row = 0; row < 9; row++) {
    frames[row] = [];
    for (let col = 0; col < 6; col++) frames[row][col] = readFrame(data, col * KLAY.size, row * KLAY.size);
  }
  return { data, frames };
}

/** A copy of klay.png with these tools painted onto every frame. */
function dressKlay(img, info, tools) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  const out = new ImageData(new Uint8ClampedArray(info.data.data), img.width, img.height);
  const paint = (frameX, frameY, i, color) => {
    const x = i % KLAY.size;
    const y = (i - x) / KLAY.size;
    const k = ((frameY + y) * img.width + frameX + x) * 4;
    const [r, gg, b] = hex(color);
    out.data[k] = r; out.data[k + 1] = gg; out.data[k + 2] = b; out.data[k + 3] = 255;
  };
  info.frames.forEach((cols, row) => cols.forEach((f, col) => {
    const fx = col * KLAY.size;
    const fy = row * KLAY.size;
    for (const tool of tools) {
      const look = DRESS[tool];
      // Lighter pixels of the original stay lighter, so the shading survives.
      if (look.hands) for (const i of f.hands) paint(fx, fy, i, look.hands[f.lum[i] >= 460 ? 0 : 1]);
      if (look.shirt) for (const i of f.shirt) paint(fx, fy, i, look.shirt[f.lum[i] >= 500 ? 1 : 0]);
      if (look.feet) {
        for (const i of f.feet) paint(fx, fy, i, look.feet[0]);
        for (const i of f.soles) paint(fx, fy, i, look.soles);
      }
      if (look.lens) {
        // Rows 2, 5 and 8 face away; their front-facing twins are rows 0, 3, 6.
        const back = row % 3 === 2 ? { eyeY: eyeRow(info.frames[row - 2][col]) } : null;
        for (const [i, part] of glassesOn(f, back)) paint(fx, fy, i, look[part]);
      }
    }
  }));
  g.putImageData(out, 0, 0);
  return c;
}

/** Where the gun goes: the front-most hand of the frame, in frame pixels. */
function gunSpots(info) {
  return info.frames.map((cols) => cols.map((f) => {
    if (!f.handSpots.length) return { x: KLAY.anchor.x + 4, y: KLAY.anchor.y - 5 };
    return f.handSpots.reduce((a, b) => (b.x > a.x ? b : a));
  }));
}

/** Where the backpack sits: the top and sides of his shirt, in frame pixels. */
function packSpots(info) {
  return info.frames.map((cols) => cols.map((f) => f.shirtBox ?? { x0: 20, x1: 28, y0: 33 }));
}

// --- Sprouts --------------------------------------------------------------------

/** Two frames side by side, like tree.png: frame 2 leans 1px above `sway`. */
function sproutSheet(rows, sway) {
  const still = pixelArt(rows, SPROUT_PALETTE, TREE_ART.h);
  const c = makeCanvas(TREE_ART.w * 2, TREE_ART.h);
  const g = c.getContext('2d');
  g.drawImage(still, 0, 0);
  g.drawImage(still, 0, sway, TREE_ART.w, TREE_ART.h - sway, TREE_ART.w, sway, TREE_ART.w, TREE_ART.h - sway);
  g.drawImage(still, 0, 0, TREE_ART.w, sway, TREE_ART.w + 1, 0, TREE_ART.w, sway);
  return c;
}

function sproutLooks(sheet) {
  return {
    sheet,
    hurt: tinted(sheet, 'rgba(255, 70, 50, 0.7)'),
    wilted: tinted(sheet, 'rgba(70, 45, 20, 0.85)'),
    glow: tinted(sheet, 'rgba(255, 248, 196, 0.85)'),   // a sunflower's bling
  };
}

/** The open sprout's rows with a different top: a step of closing up. */
const withTop = (name, top) => top.concat(SPROUT_ROWS[name].slice(top.length));

export const coinArt = () => pixelArt(COIN_ROWS, ART_PALETTE);
export const toolIconArt = (id) => pixelArt(TOOL_ICON_ROWS[id], ART_PALETTE);
export const shopIconArt = (id) => pixelArt(SHOP_ICON_ROWS[id], ART_PALETTE);
export const gadgetIconArt = (id) => pixelArt(GADGET_ICON_ROWS[id], ART_PALETTE);

export async function loadSprites() {
  const [bg, klay, bac, tree, boss] = await Promise.all([
    loadImage('bg.png'),
    loadImage('klay.png'),
    loadImage('bacteiras.png'),
    loadImage('tree.png'),
    loadImage('boss.png'),
  ]);
  const info = readKlay(klay);
  // Klayman in any mix of tools, painted the first time it's needed: as he
  // is, poisoned green, and (the booster) red with power, then grey.
  const looks = new Map();
  const lookFor = (tools = []) => {
    const wear = DRESSABLE.filter((t) => tools.includes(t));
    const key = wear.join('+') || 'none';
    if (!looks.has(key)) {
      const sheet = wear.length ? dressKlay(klay, info, wear) : klay;
      looks.set(key, {
        sheet,
        green: tinted(sheet, 'rgba(96, 196, 72, 0.55)'),
        red: tinted(sheet, 'rgba(236, 52, 40, 0.62)'),
        grey: greyed(sheet),
      });
    }
    return looks.get(key);
  };
  const sprouts = { sprout: sproutLooks(tree) };
  for (const [name, rows] of Object.entries(SPROUT_ROWS)) {
    sprouts[name] = sproutLooks(sproutSheet(rows, SPROUT_SWAY[name]));
    // Closing up: the open look, each step, then closed. Corn darkens as its
    // leaves close; a lily just curls up.
    const steps = CLOSING_ROWS[name];
    if (steps) {
      sprouts[name].steps = [sprouts[name], ...steps.map((top, i) => {
        let sheet = sproutSheet(withTop(name, top), SPROUT_SWAY[name]);
        if (name === 'corn') sheet = tinted(sheet, `rgba(16, 26, 8, ${(0.32 * (i + 1)) / steps.length})`);
        return sproutLooks(sheet);
      })];
    }
  }
  const icons = {
    plus: iconArt('plus'),
    bag: iconArt('bag'),
    water: iconArt('water'),
    sandclock: iconArt('sandclock'),
  };
  const gunFrom = (arts) => Object.fromEntries(
    Object.entries(arts).map(([facing, art]) => [facing, { ...art, img: pixelArt(art.rows, ART_PALETTE) }]),
  );

  return {
    bg,
    klay,
    lookFor,
    gunSpots: gunSpots(info),
    gun: gunFrom(GUN_ART),
    gunSmall: gunFrom(GUN_ART_SMALL),
    sprouts,
    coin: coinArt(),
    toolIcons: Object.fromEntries(Object.keys(TOOL_ICON_ROWS).map((id) => [id, toolIconArt(id)])),
    shopIcons: Object.fromEntries(Object.keys(SHOP_ICON_ROWS).map((id) => [id, shopIconArt(id)])),
    gadgetIcons: Object.fromEntries(Object.keys(GADGET_ICON_ROWS).map((id) => [id, gadgetIconArt(id)])),
    pack: Object.fromEntries(Object.entries(PACK_ART).map(([side, rows]) => [side, pixelArt(rows, ART_PALETTE)])),
    packSpots: packSpots(info),
    leaf: pixelArt(LEAF_ROWS, ART_PALETTE),
    bottle: pixelArt(BOTTLE_ROWS, ART_PALETTE),
    bacSlow: tinted(bac, 'rgba(176, 110, 214, 0.5)'),
    bac,
    bacFrozen: tinted(bac, 'rgba(150, 215, 255, 0.55)'),
    boss: {
      sheet: boss,
      hit: tinted(boss, 'rgba(255, 255, 255, 0.8)'),       // the flash when dirt lands on it
      frozen: tinted(boss, 'rgba(150, 215, 255, 0.55)'),   // a sandclock
    },
    shovel: { img: pixelArt(SHOVEL_ROWS, ART_PALETTE), grip: SHOVEL_GRIP },
    heart: heartArt('full'),
    halfHeart: heartArt('half'),
    icons,
    // A sunflower's items, lit up: they glow, so you know they're the flower's.
    iconsGlow: Object.fromEntries(Object.entries(icons).map(([id, img]) => [id, tinted(img, 'rgba(255, 246, 190, 0.85)')])),
  };
}

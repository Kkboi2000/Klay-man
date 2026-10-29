// The world is bg.png blown up by POT_SCALE. Everything walks on the soil.
// Since v22 the pot is seen from straight above, so the soil is a perfect
// circle (make-pot.py draws bg.png; these numbers match it).
import { POT_SCALE as P } from './config.js';

export const WORLD = { w: 560 * P, h: 560 * P };

export const SOIL = { cx: 280 * P, cy: 280 * P, rx: 171 * P, ry: 171 * P };

// How far the camera may wander: the pot and a little gray around it.
export const CAMERA_BOUNDS = { x0: 43 * P, y0: 43 * P, x1: 517 * P, y1: 517 * P };

// The dark hole in the soil where the sprout grows.
export const TREE_SPOT = { x: 275 * P, y: 293 * P };

const RATIO = SOIL.ry / SOIL.rx;

/** <= 1 inside the soil shrunk by `inset` px (measured horizontally). */
export function soilValue(x, y, inset = 0) {
  const rx = SOIL.rx - inset;
  const ry = SOIL.ry - inset * RATIO;
  const dx = (x - SOIL.cx) / rx;
  const dy = (y - SOIL.cy) / ry;
  return dx * dx + dy * dy;
}

export function insideSoil(x, y, inset = 0) {
  return soilValue(x, y, inset) <= 1;
}

/** Pull a point back onto the soil if it stepped past the edge. */
export function keepOnSoil(p, inset = 0) {
  const v = soilValue(p.x, p.y, inset);
  if (v <= 1) return false;
  const k = 1 / Math.sqrt(v);
  p.x = SOIL.cx + (p.x - SOIL.cx) * k;
  p.y = SOIL.cy + (p.y - SOIL.cy) * k;
  return true;
}

export function rimPoint(angle, inset = 0) {
  return {
    x: SOIL.cx + Math.cos(angle) * (SOIL.rx - inset),
    y: SOIL.cy + Math.sin(angle) * (SOIL.ry - inset * RATIO),
  };
}

/** A random spot on the soil near `center`, not too close to `avoid`. */
export function randomSpotNear(center, minR, maxR, rng, avoid = null) {
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2;
    const r = minR + rng() * (maxR - minR);
    const p = { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r };
    if (!insideSoil(p.x, p.y, 28)) continue;
    if (avoid && dist(p, avoid) < 50) continue;
    return p;
  }
  return { x: center.x, y: center.y + minR };
}

/** A random spot anywhere on the soil, evenly spread, `inset` px from the edge. */
export function randomSpotOnSoil(rng, inset = 30) {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng());
  return {
    x: SOIL.cx + Math.cos(a) * r * (SOIL.rx - inset),
    y: SOIL.cy + Math.sin(a) * r * (SOIL.ry - inset * RATIO),
  };
}

// Rings on the soil (spores, the leaf, the shovel, a revived sprout) were
// drawn flatter than wide while the pot was seen at an angle. Seen from
// above (v22), they're round: as deep as they are wide.
export const RING_SQUASH = 1;

/** Inside a ring of radius `reach` centred on `c`, drawn as the pot sees it. */
export function insideRing(p, c, reach) {
  const dx = (p.x - c.x) / reach;
  const dy = (p.y - c.y) / (reach * RING_SQUASH);
  return dx * dx + dy * dy <= 1;
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

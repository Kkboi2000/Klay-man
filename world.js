// The world is bg.png blown up by POT_SCALE. Everything walks on the soil.
import { POT_SCALE as P } from './config.js';

export const WORLD = { w: 684 * P, h: 508 * P };

export const SOIL = { cx: 319.5 * P, cy: 250.5 * P, rx: 215.5 * P, ry: 135.5 * P };

// How far the camera may wander: the pot and a little gray around it.
export const CAMERA_BOUNDS = { x0: 30 * P, y0: 62 * P, x1: 608 * P, y1: 470 * P };

// The dark hole in the soil where the sprout grows.
export const TREE_SPOT = { x: 313 * P, y: 262 * P };

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

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

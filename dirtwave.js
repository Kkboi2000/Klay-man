// The bazoo-klay's shot (v27): a wave of dirt fanning out from the muzzle,
// TOOLS.bazoo.cone degrees wide. Its front sweeps out at a shot's speed less
// 15%, and is gone at its range. The game hits whatever the front passes over,
// once each (`hit`).
import { SHOT, TOOLS } from './config.js';

const HALF = ((TOOLS.bazoo.cone / 2) * Math.PI) / 180;

export class DirtWave {
  constructor(x, y, dir, { range }) {
    const d = Math.hypot(dir.x, dir.y) || 1;
    this.x = x;                  // where it set out
    this.y = y;
    this.ux = dir.x / d;         // the way it fans out
    this.uy = dir.y / d;
    this.speed = SHOT.speed * TOOLS.bazoo.waveSpeed;
    this.range = range;
    this.r = 0;                  // how far out its front is
    this.hit = new Set();
    this.dead = false;
  }

  /** How far through its flight it is, 0 to 1. */
  get progress() { return Math.min(1, this.r / this.range); }

  /** Half the fan's width, in radians. */
  get half() { return HALF; }

  update(dt) {
    this.r += this.speed * dt;
    if (this.r >= this.range) this.dead = true;
  }

  /** The front has reached `p` (`pad` round): inside the fan, and passed over it. */
  reaches(p, pad = 0) {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= pad) return true;                    // right at the muzzle
    if (d - pad > this.r || d - pad > this.range) return false;
    const off = Math.acos(Math.max(-1, Math.min(1, (dx * this.ux + dy * this.uy) / d)));
    return off <= HALF + Math.asin(Math.min(1, pad / d));
  }
}

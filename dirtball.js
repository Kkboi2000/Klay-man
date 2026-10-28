// Ported from dirtball.gd. Pushed in one of four directions, rolls until it
// hits something, then breaks. Left alone too long, it cracks open. Spores
// can slide it along the soil without setting it rolling.
import { DIRTBALL, KNOCK_TIME } from './config.js';

export const DIRTBALL_BREAK_TIME = 0.4;

export class Dirtball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.state = 'idle';         // idle | rolling | breaking
    this.hold = DIRTBALL.holdTime;
    this.vx = 0;
    this.vy = 0;
    this.fx = 0;
    this.dead = false;
    this.cracked = false;        // set when the hold runs out
    this.knock = 0;              // seconds left of a spore slide
    this.kx = 0;
    this.ky = 0;
  }

  get solid() { return this.state === 'idle'; }
  /** The dirt gun can lock on to it (dirt only breaks it from level 7: the game decides). */
  get lockable() { return this.solid; }

  /** dirtball.gd push(): snaps to the strongest axis. */
  push(dir) {
    if (this.state !== 'idle') return;
    if (Math.abs(dir.x) > Math.abs(dir.y)) {
      this.vx = Math.sign(dir.x) * DIRTBALL.speed;
      this.vy = 0;
    } else {
      this.vx = 0;
      this.vy = Math.sign(dir.y) * DIRTBALL.speed;
    }
    this.knock = 0;
    this.state = 'rolling';
  }

  /** Spores: slides `distance` along (dx, dy), easing to a stop. */
  knockBack(dx, dy, distance) {
    if (this.state !== 'idle') return;
    const d = Math.hypot(dx, dy) || 1;
    const v = (2 * distance) / KNOCK_TIME;
    this.kx = (dx / d) * v;
    this.ky = (dy / d) * v;
    this.knock = KNOCK_TIME;
  }

  breakApart() {
    if (this.state === 'breaking') return false;
    this.state = 'breaking';
    this.fx = 0;
    return true;
  }

  update(dt, frozen) {
    if (this.state === 'breaking') {
      this.fx += dt;
      if (this.fx >= DIRTBALL_BREAK_TIME) this.dead = true;
    } else if (this.state === 'rolling') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else if (!frozen) {
      if (this.knock > 0) {
        const k = this.knock / KNOCK_TIME;
        this.x += this.kx * k * dt;
        this.y += this.ky * k * dt;
        this.knock = Math.max(0, this.knock - dt);
      }
      this.hold -= dt;
      if (this.hold <= 0) this.cracked = true;
    }
  }
}

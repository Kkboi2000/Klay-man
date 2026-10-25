// Ported from dirtball.gd. Pushed in one of four directions, rolls until it
// hits something, then breaks. Left alone too long, it cracks open.
import { DIRTBALL } from './config.js';

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
  }

  get solid() { return this.state === 'idle'; }

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
    this.state = 'rolling';
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
      this.hold -= dt;
      if (this.hold <= 0) this.cracked = true;
    }
  }
}

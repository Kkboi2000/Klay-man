// Ported from dirtshot.gd: flies forward, gone after max_range.
// Each bacteria has a little magnetism: a shot that passes close by bends
// toward it, so throws don't have to be exact. A dirt gun shot is locked on
// to one bacteria and turns hard enough to reach it from any angle.
import { GUN, SHOT } from './config.js';
import { insideSoil } from './world.js';

const AHEAD = Math.cos((75 * Math.PI) / 180); // only pulled by bacteria in front

export class DirtShot {
  constructor(x, y, dir, { range = SHOT.range, target = null } = {}) {
    this.x = x;
    this.y = y;
    this.vx = dir.x * SHOT.speed;
    this.vy = dir.y * SHOT.speed;
    this.range = range;
    this.target = target;
    this.travelled = 0;
    this.dead = false;
  }

  get locked() { return Boolean(this.target?.alive); }

  update(dt, bacteria = []) {
    if (this.locked) this.bendToward(this.target, dt, GUN.lockTurn);
    else this.bendToward(this.nearestAhead(bacteria), dt, SHOT.magnetTurn);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.travelled += SHOT.speed * dt;
    if (this.travelled > this.range || !insideSoil(this.x, this.y, -6)) this.dead = true;
  }

  /** The closest bacteria inside the magnet range, and not behind the shot. */
  nearestAhead(bacteria) {
    let best = null;
    let bestD = SHOT.magnetRange;
    for (const b of bacteria) {
      if (!b.alive) continue;
      const dx = b.x - this.x;
      const dy = b.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d >= bestD || d < 0.001) continue;
      const facing = (dx * this.vx + dy * this.vy) / (d * SHOT.speed);
      if (facing < AHEAD) continue;
      best = b;
      bestD = d;
    }
    return best;
  }

  /** Turns the shot toward the target, at most `rate` radians a second. */
  bendToward(target, dt, rate) {
    if (!target) return;
    const now = Math.atan2(this.vy, this.vx);
    let turn = Math.atan2(target.y - this.y, target.x - this.x) - now;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // shortest way round
    const max = rate * dt;
    const a = now + Math.max(-max, Math.min(max, turn));
    this.vx = Math.cos(a) * SHOT.speed;
    this.vy = Math.sin(a) * SHOT.speed;
  }
}

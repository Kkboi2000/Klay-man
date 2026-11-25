// A yellow bacteria's germ (v27): spat from its eye at where Klayman stood,
// it flies straight, and is gone once it's out of range or off the soil.
import { KINDS } from './config.js';
import { insideSoil } from './world.js';

export class Germ {
  constructor(x, y, dir) {
    const { speed, range } = KINDS.yellow.germ;
    const d = Math.hypot(dir.x, dir.y) || 1;
    this.x = x;
    this.y = y;
    this.vx = (dir.x / d) * speed;
    this.vy = (dir.y / d) * speed;
    this.range = range;
    this.travelled = 0;
    this.t = 0;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.travelled += Math.hypot(this.vx, this.vy) * dt;
    if (this.travelled > this.range || !insideSoil(this.x, this.y, -6)) this.dead = true;
  }
}

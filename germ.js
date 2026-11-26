// An orange bacteria's germ (v27): spat from its eye at where Klayman stood,
// it flies straight, and is gone once it's out of range or off the soil.
import { KINDS } from './config.js';
import { insideSoil } from './world.js';

export class Germ {
  constructor(x, y, dir) {
    const { speed, range } = KINDS.orange.germ;
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

/** A blue bacteria's light-blue shot (v29): it flies at one bit of dirt (a
 *  bacteria in dirt, or a dirtball), following it, and `landed` once it's
 *  there. The game takes the dirt off; it's gone if the dirt is first. */
export class Zap {
  constructor(x, y, target) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.t = 0;
    this.landed = false;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = KINDS.blue.zap.speed * dt;
    if (d <= step + 4) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.landed = true;
      return;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
  }
}

/** A cactus's thorn (v29): it flies from the cactus at one bacteria or
 *  dirtball, following it, and `landed` once it's there. */
export class Thorn {
  constructor(x, y, target, speed) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = speed;
    this.t = 0;
    this.landed = false;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    this.vx = dx / (d || 1);
    this.vy = dy / (d || 1);
    if (d <= step + 4) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.landed = true;
      return;
    }
    this.x += this.vx * step;
    this.y += this.vy * step;
  }
}

// Ported from dirtshot.gd: flies straight, gone after max_range.
import { SHOT } from './config.js';
import { insideSoil } from './world.js';

export class DirtShot {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.vx = dir.x * SHOT.speed;
    this.vy = dir.y * SHOT.speed;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const travelled = Math.hypot(this.x - this.startX, this.y - this.startY);
    if (travelled > SHOT.range || !insideSoil(this.x, this.y, -6)) this.dead = true;
  }
}

// Ported from bacteria.gd. Crawls to the sprout; each dirt hit adds a layer and
// stops it. Left alone, it sheds one layer every decay_time and crawls again.
// With no sprout in sight (a closed lily) it wanders, keeping away from it.
import { BACTERIA, KNOCK_TIME } from './config.js';

export const BREAK_TIME = 0.4;   // green splat animation
export const ABSORB_TIME = 0.3;  // sucked into the sprout or into Klayman
const WANDER_CLEAR = 90;         // a wandering bacteria turns away inside this

export class Bacteria {
  constructor(x, y, speed = BACTERIA.speed) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.dirt = 0;
    this.decay = 0;
    this.state = 'crawl';        // crawl | dirty | breaking | absorbed
    this.t = 0;                  // animation clock
    this.fx = 0;                 // clock for breaking / absorbed
    this.absorbTo = null;
    this.wobble = Math.random() * Math.PI * 2;
    this.dead = false;
    this.knock = 0;              // seconds left of a spore push
    this.kx = 0;
    this.ky = 0;
    this.slow = 0;               // seconds left at slowFactor speed
    this.slowFactor = 1;
  }

  get crawling() { return this.state === 'crawl'; }
  get alive() { return this.state === 'crawl' || this.state === 'dirty'; }

  /** Adds dirt. Returns true when it is covered enough to become a dirtball. */
  addDirt(amount = 1) {
    if (!this.alive) return false;
    this.dirt = Math.min(BACTERIA.maxDirt, this.dirt + amount);
    this.decay = BACTERIA.decayTime;
    this.state = 'dirty';
    return this.dirt >= BACTERIA.maxDirt;
  }

  /** bacteria.gd set_dirt_stage: used when a dirtball cracks open. */
  setDirtStage(stage) {
    this.dirt = Math.max(0, Math.min(stage, BACTERIA.maxDirt - 1));
    this.decay = BACTERIA.decayTime;
    this.state = this.dirt > 0 ? 'dirty' : 'crawl';
  }

  /** Which dirt row of the sprite sheet to show: one row per layer. */
  get look() {
    return Math.max(0, Math.min(3, Math.floor(this.dirt)));
  }

  breakApart() {
    this.state = 'breaking';
    this.fx = 0;
  }

  /** Spores or a revived sprout: slide `distance` along (dx, dy), then maybe crawl slowly. */
  knockBack(dx, dy, distance, slowTime = 0, slowFactor = 1) {
    const d = Math.hypot(dx, dy) || 1;
    const v = (2 * distance) / KNOCK_TIME;   // easing out to a stop
    this.kx = (dx / d) * v;
    this.ky = (dy / d) * v;
    this.knock = KNOCK_TIME;
    if (slowTime > 0) this.slowDown(slowTime, slowFactor);
  }

  /** Crawls at `factor` speed for `time` seconds. The stronger slow wins.
   *  Returns true if it wasn't slowed before. */
  slowDown(time, factor) {
    const fresh = this.slow <= 0;
    if (fresh || factor <= this.slowFactor) {
      this.slowFactor = factor;
      this.slow = Math.max(this.slow, time);
    }
    return fresh;
  }

  get slowed() { return this.slow > 0; }

  absorbInto(target) {
    this.state = 'absorbed';
    this.fx = 0;
    this.absorbTo = { x: target.x, y: target.y };
  }

  /** Meanders on a heading that drifts by itself; near `avoid`, turns away. */
  wander(dt, speed, avoid) {
    const s = this.wobble;
    let a = s * 3 + 1.7 * Math.sin(this.t * 0.8 + s * 2) + 1.1 * Math.sin(this.t * 0.31 + s);
    let ux = Math.cos(a), uy = Math.sin(a);
    if (avoid) {
      const ax = this.x - avoid.x, ay = this.y - avoid.y;
      const d = Math.hypot(ax, ay) || 1;
      const k = Math.max(0, 1 - d / WANDER_CLEAR);   // 1 right at it, 0 far away
      ux += (ax / d) * k * 2;
      uy += (ay / d) * k * 2;
      const n = Math.hypot(ux, uy) || 1;
      ux /= n; uy /= n;
    }
    this.x += ux * speed * dt;
    this.y += uy * speed * dt;
  }

  /** `target` is the sprout, or null when it can't be seen; then the
   *  bacteria wanders and steers clear of `avoid`. */
  update(dt, target, frozen, avoid = null) {
    if (this.state === 'breaking') {
      this.fx += dt;
      if (this.fx >= BREAK_TIME) this.dead = true;
      return;
    }
    if (this.state === 'absorbed') {
      this.fx += dt;
      const k = Math.min(1, dt * 12);
      this.x += (this.absorbTo.x - this.x) * k;
      this.y += (this.absorbTo.y - this.y) * k;
      if (this.fx >= ABSORB_TIME) this.dead = true;
      return;
    }
    if (frozen) return;
    this.t += dt;

    if (this.state === 'crawl') {
      if (this.knock > 0) {
        const k = this.knock / KNOCK_TIME;
        this.x += this.kx * k * dt;
        this.y += this.ky * k * dt;
        this.knock = Math.max(0, this.knock - dt);
        return;
      }
      let speed = this.speed;
      if (this.slow > 0) {
        speed *= this.slowFactor;
        this.slow = Math.max(0, this.slow - dt);
      }
      if (!target) {
        this.wander(dt, speed, avoid);
        return;
      }
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      // A slight side-to-side wiggle so they don't march in perfect lines.
      const wiggle = Math.sin(this.t * 3 + this.wobble) * 0.25;
      const ux = dx / d, uy = dy / d;
      this.x += (ux - uy * wiggle) * speed * dt;
      this.y += (uy + ux * wiggle) * speed * dt;
    } else if (this.state === 'dirty') {
      this.decay -= dt;
      if (this.decay <= 0) {
        this.dirt = Math.max(0, this.dirt - 1);
        this.decay = BACTERIA.decayTime;
        if (this.dirt <= 0) this.state = 'crawl';
      }
    }
  }
}

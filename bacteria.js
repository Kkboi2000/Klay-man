// Ported from bacteria.gd. Crawls to the sprout; each dirt hit adds a layer and
// stops it. Left alone, it sheds one layer every decay_time and crawls again.
// With no sprout in sight (a closed lily) it wanders, keeping away from it.
// Dirt is counted in throws: BACTERIA.maxDirt of it makes a dirtball.
//
// Since v27 there are three kinds (KINDS in config.js). Green: the bacteria
// above. Orange (Spitter): bounces after Klayman and spits germs at him (the
// game fires them). Blue (Stomper): walks to dirt and stamps it off (the
// game does the stamping). Neither goes into the sprout or into Klayman.
import { BACTERIA, KINDS, KNOCK_TIME } from './config.js';

export const BREAK_TIME = 0.4;   // green splat animation
export const ABSORB_TIME = 0.3;  // sucked into the sprout or into Klayman
const WANDER_CLEAR = 90;         // a wandering bacteria turns away inside this

export class Bacteria {
  constructor(x, y, speed = BACTERIA.speed) {
    this.kind = 'green';
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
    this.flung = false;          // the push is the whirlwind's: it flies, rather than slides
    this.kx = 0;
    this.ky = 0;
    this.slow = 0;               // seconds left at slowFactor speed
    this.slowFactor = 1;
    this.decayTime = BACTERIA.decayTime; // seconds to shed a layer (autumn: longer)
  }

  get crawling() { return this.state === 'crawl'; }
  /** It gets inside the sprout, or Klayman, when it reaches them: only green ones do. */
  get invades() { return true; }
  get alive() { return this.state === 'crawl' || this.state === 'dirty'; }
  /** The dirt gun can lock on to it. */
  get lockable() { return this.alive; }

  /** Adds dirt. Returns true when it is covered enough to become a dirtball. */
  addDirt(amount = 1) {
    if (!this.alive) return false;
    this.dirt = Math.min(BACTERIA.maxDirt, this.dirt + amount);
    this.decay = this.decayTime;
    this.state = 'dirty';
    return this.dirt >= BACTERIA.maxDirt;
  }

  /** A blue bacteria's stamp: `layers` of dirt off at once. Clean, it crawls again. */
  shed(layers) {
    if (this.state !== 'dirty') return;
    this.dirt = Math.max(0, this.dirt - layers);
    this.decay = this.decayTime;
    if (this.dirt <= 0) this.state = 'crawl';
  }

  /** bacteria.gd set_dirt_stage: used when a dirtball cracks open. */
  setDirtStage(stage) {
    this.dirt = Math.max(0, Math.min(stage, BACTERIA.maxDirt - 1));
    this.decay = this.decayTime;
    this.state = this.dirt > 0 ? 'dirty' : 'crawl';
  }

  /** Which dirt row of the sprite sheet to show (0-3 layers). The third
   *  layer always means one throw to go; the first two share the rest. */
  get look() {
    if (this.dirt <= 0) return 0;
    const last = BACTERIA.maxDirt - 1;
    if (this.dirt >= last - 1e-9) return 3;
    return Math.min(2, 1 + Math.floor((this.dirt / last) * 2));
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

  /** The whirlwind's gust: thrown `distance` along (dx, dy), through the air. */
  fling(dx, dy, distance) {
    this.knockBack(dx, dy, distance);
    this.flung = true;
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
  wander(dt, speed, avoid, clear = WANDER_CLEAR) {
    const s = this.wobble;
    const a = s * 3 + 1.7 * Math.sin(this.t * 0.8 + s * 2) + 1.1 * Math.sin(this.t * 0.31 + s);
    const [ux, uy] = shy(this, Math.cos(a), Math.sin(a), avoid, clear);
    this.x += ux * speed * dt;
    this.y += uy * speed * dt;
  }

  /** How it gets about while crawling: straight for `target` with a slight
   *  wiggle, or (no target) wandering clear of `avoid`. */
  move(dt, speed, target, avoid) {
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
  }

  /** `target` is where it's headed (a green one: the sprout, or null when it
   *  can't be seen; then it wanders and steers clear of `avoid`). `pace`
   *  slows every bacteria at once (fertilizer). */
  update(dt, target, frozen, avoid = null, pace = 1) {
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

    // A spore push slides it along, crawling or dirty.
    if (this.knock > 0) {
      const k = this.knock / KNOCK_TIME;
      this.x += this.kx * k * dt;
      this.y += this.ky * k * dt;
      this.knock = Math.max(0, this.knock - dt);
      if (this.knock === 0) this.flung = false;
      if (this.state === 'crawl') return;
    }

    if (this.state === 'crawl') {
      let speed = this.speed * pace;
      if (this.slow > 0) {
        speed *= this.slowFactor;
        this.slow = Math.max(0, this.slow - dt);
      }
      this.move(dt, speed, target, avoid);
    } else if (this.state === 'dirty') {
      this.decay -= dt;
      if (this.decay <= 0) {
        this.dirt = Math.max(0, this.dirt - 1);
        this.decay = this.decayTime;
        if (this.dirt <= 0) this.state = 'crawl';
      }
    }
  }
}

/** Turns a heading (ux, uy) away from `avoid` when it's within `clear`: hard
 *  right next to it, not at all at `clear`. Returns the new unit heading. */
function shy(p, ux, uy, avoid, clear) {
  if (!avoid) return [ux, uy];
  const ax = p.x - avoid.x, ay = p.y - avoid.y;
  const d = Math.hypot(ax, ay) || 1;
  const k = Math.max(0, 1 - d / clear);           // 1 right at it, 0 far away
  ux += (ax / d) * k * 2;
  uy += (ay / d) * k * 2;
  const n = Math.hypot(ux, uy) || 1;
  return [ux / n, uy / n];
}

/** Heads for `goal` and stops `near` it, clear of `avoid` (the sprout). */
function approach(b, dt, speed, goal, near, avoid, clear) {
  const dx = goal.x - b.x;
  const dy = goal.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d <= near) return false;
  const [ux, uy] = shy(b, dx / d, dy / d, avoid, clear);
  const step = Math.min(speed * dt, d - near);
  b.x += ux * step;
  b.y += uy * step;
  return true;
}

/** Orange (v27): one eye, no legs. It bounces after Klayman (`target`), never
 *  into the sprout (`avoid`), and stops once he's in reach. The game charges
 *  and fires its germs: `cooldown` till it can charge again, `charging` the
 *  second it spends charging one up, standing still. */
export class Spitter extends Bacteria {
  constructor(x, y, speed) {
    super(x, y, speed);
    this.kind = 'orange';
    this.hopT = Math.random();     // where in a bounce it is (0 to 1)
    this.cooldown = 0;
    this.charging = 0;
  }

  get invades() { return false; }

  /** How high it is in its bounce, 0 (on the soil) to 1. */
  get lift() { return this.crawling && this.charging <= 0 ? Math.sin(this.hopT * Math.PI) : 0; }

  addDirt(amount = 1) {
    this.charging = 0;             // dirt on it: the germ it was charging is lost
    return super.addDirt(amount);
  }

  move(dt, speed, target, avoid) {
    if (this.charging > 0) return;
    this.hopT = (this.hopT + dt / KINDS.orange.hop) % 1;
    // It only gets anywhere in the air: twice as fast then, so it keeps up on the whole.
    const air = 2 * Math.sin(this.hopT * Math.PI);
    if (!target) this.wander(dt, speed * air, avoid, KINDS.blue.keepOff);
    else approach(this, dt, speed * air, target, KINDS.orange.reach * 0.8, avoid, KINDS.blue.keepOff);
  }
}

/** Blue (v27; v30: Krit's drawing, the orange's size). It bounces the
 *  orange way, 2.5 times slower, to the nearest dirt (`target`: a dirty
 *  bacteria or a dirtball, or null: it wanders), never near the sprout
 *  (`avoid`), and stops in reach (bouncing on the spot). The game does the
 *  stamping: `cooldown` till the next; `jump`, the seconds into a jump (0
 *  on the ground): up, down (the stamp, and its shot), and one small bounce. */
export class Stomper extends Bacteria {
  constructor(x, y, speed) {
    super(x, y, speed);
    this.kind = 'blue';
    this.cooldown = 2;             // a moment after it's out before the first stamp
    this.jump = 0;
    this.hopT = Math.random();     // where in a bounce it is (0 to 1)
  }

  get invades() { return false; }

  get jumping() { return this.jump > 0; }

  /** How high it is, 0 (on the soil) to 1: in a bounce, or its jump to
   *  stamp (twice as high), then a bounce a third as high. */
  get lift() {
    if (!this.crawling) return 0;
    if (!this.jumping) return Math.sin(this.hopT * Math.PI);
    const { jump, land } = KINDS.blue;
    const t = this.jump;
    if (t < land) return 2 * Math.sin((Math.PI * t) / land);
    return 0.6 * Math.sin((Math.PI * (t - land)) / (jump - land));
  }

  addDirt(amount = 1) {
    this.jump = 0;                 // dirt on it: down it comes
    return super.addDirt(amount);
  }

  move(dt, speed, target, avoid) {
    const { keepOff, reach, hop, pace } = KINDS.blue;
    if (this.jumping) return;
    this.hopT = (this.hopT + dt / hop) % 1;
    // Like an orange one, it only gets anywhere in the air.
    const air = 2 * Math.sin(this.hopT * Math.PI) * pace;
    if (!target) this.wander(dt, speed * air, avoid, keepOff);
    else approach(this, dt, speed * air, target, reach * 0.7, avoid, keepOff);
  }
}

/** A bacteria of `kind` ('green', 'orange' or 'blue'). */
export function makeBacteria(kind, x, y, speed) {
  if (kind === 'orange') return new Spitter(x, y, speed);
  if (kind === 'blue') return new Stomper(x, y, speed);
  return new Bacteria(x, y, speed);
}

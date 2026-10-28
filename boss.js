// A boss bacteria: four times a bacteria, rooted to one spot near a corner of
// the pot. It climbs out of the ground, sends out a bacteria every few
// seconds and wears down under dirt: 1 a throw, 5 a rolling dirtball. Worn
// out, it sags and sweats, then burrows back down. It never moves.
import { BOSS } from './config.js';

/** Levels 5, 10, 15, ... end with a boss. */
export const isBossLevel = (n) => n >= BOSS.firstLevel && (n - BOSS.firstLevel) % BOSS.every === 0;

/** A boss's HP at level `n`: 50 at level 5, 100 at 10, 150 at 15, ... */
export const bossHp = (n) => n * BOSS.hpPerLevel;

/** Seconds between the bacteria a boss sends out at level `n`: 2.5 at 10,
 *  a step less every boss level after (a step more before), never under the minimum. */
export function bossSpawnEvery(n) {
  const { at, every, step, min } = BOSS.spawn;
  const steps = Math.floor((n - at) / BOSS.every);
  return Math.max(min, every - step * steps);
}

export class Boss {
  constructor(x, y, { hp, spawnEvery }) {
    this.x = x;                  // where its feet are, like every bacteria
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.spawnEvery = spawnEvery;
    this.spawnTimer = spawnEvery; // the first bacteria comes a beat after it's out
    this.state = 'rising';       // rising | active | tired | burrowing | gone
    this.fx = 0;                 // seconds in the current state
    this.t = 0;                  // animation clock
    this.flash = 0;              // seconds left of the flash from a hit
  }

  /** Still fighting: it can be hit and locked on to. */
  get alive() { return this.state === 'rising' || this.state === 'active'; }
  get lockable() { return this.alive; }
  /** It stands in the way until it's halfway back into the ground. */
  get solid() { return this.state !== 'gone' && !(this.state === 'burrowing' && this.fx > BOSS.burrow / 2); }
  get gone() { return this.state === 'gone'; }
  /** HP left, from 1 (untouched) to 0. */
  get hpShare() { return this.hp / this.maxHp; }

  /** The middle of where it stands: what a gun shot aims at. */
  get aimPoint() { return { x: this.x, y: this.y - BOSS.foot.lift }; }

  /** Where `p` is against its footprint grown by `pad`: under 1 is inside. */
  reachOf(p, pad = 0) {
    const { rx, ry, lift } = BOSS.foot;
    return Math.hypot((p.x - this.x) / (rx + pad), (p.y - (this.y - lift)) / (ry + pad));
  }

  touches(p, pad = 0) { return this.reachOf(p, pad) < 1; }

  /** How far `p` is from the edge of its footprint (0 inside it). */
  gap(p) {
    const c = this.aimPoint;
    const k = this.reachOf(p);
    return k <= 1 ? 0 : Math.hypot(p.x - c.x, p.y - c.y) * (1 - 1 / k);
  }

  /** Moves `p` out to the edge of its footprint grown by `pad`. */
  pushOut(p, pad = 0) {
    const k = this.reachOf(p, pad);
    if (k >= 1) return false;
    const c = this.aimPoint;
    let dx = p.x - c.x;
    let dy = p.y - c.y;
    if (Math.hypot(dx, dy) < 0.001) { dx = 0; dy = 1; }
    const edge = this.reachOf({ x: c.x + dx, y: c.y + dy }, pad);
    p.x = c.x + dx / edge;
    p.y = c.y + dy / edge;
    return true;
  }

  /** Dirt lands on it. Returns true if that wore it out. */
  hit(damage) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.flash = 0.12;
    if (this.hp > 0) return false;
    this.state = 'tired';
    this.fx = 0;
    return true;
  }

  /** Steps it on. Returns true when it sends out a bacteria this step.
   *  A sandclock holds it still; once it's worn out, nothing does. */
  update(dt, frozen) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.state === 'gone' || (frozen && this.alive)) return false;
    this.t += dt;
    this.fx += dt;
    if (this.state === 'rising' && this.fx >= BOSS.rise) this.next('active');
    else if (this.state === 'tired' && this.fx >= BOSS.tired) this.next('burrowing');
    else if (this.state === 'burrowing' && this.fx >= BOSS.burrow) this.next('gone');
    else if (this.state === 'active') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer += this.spawnEvery;
        return true;
      }
    }
    return false;
  }

  next(state) {
    this.state = state;
    this.fx = 0;
  }
}

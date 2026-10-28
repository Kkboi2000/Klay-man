// A gadget in play: ready, then its effect runs for a while, then it cools
// down before it can be used again. What the effect does is the game's
// business (game.js); this only keeps the clock.
import { GADGETS } from './config.js';

export class Gadget {
  constructor(id) {
    this.id = id;
    this.spec = GADGETS[id];
    this.on = 0;                 // seconds of effect left
    this.wait = 0;               // seconds of cooldown left
    this.t = 0;                  // seconds since it was last used
  }

  get ready() { return this.on <= 0 && this.wait <= 0; }
  get active() { return this.on > 0; }

  /** How far it has charged back: 0 just after its effect, 1 when ready. */
  get charge() {
    if (this.on > 0) return 0;
    return 1 - this.wait / this.spec.cooldown;
  }

  use() {
    if (!this.ready) return false;
    this.on = this.spec.time;
    this.t = 0;
    return true;
  }

  /** Steps the clock. Returns 'end' when the effect stops, 'ready' when it
   *  has cooled down, otherwise null. */
  update(dt) {
    if (this.on > 0) {
      this.t += dt;
      this.on = Math.max(0, this.on - dt);
      if (this.on > 0) return null;
      this.wait = this.spec.cooldown;
      return 'end';
    }
    if (this.wait > 0) {
      this.wait = Math.max(0, this.wait - dt);
      if (this.wait === 0) return 'ready';
    }
    return null;
  }
}

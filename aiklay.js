// The AI gadget's Klayman (v29): a see-through, light-blue digital Klayman.
// It blinks up like a neon sign, works, and blinks out (GADGETS.ai). While it
// works it goes for whatever is nearest it: a bacteria, it throws plain dirt
// at; a dirtball, it walks round behind and pushes into the nearest bacteria.
// It has none of Klayman's tools, but walks and throws 1.5 times as fast as
// he does right now (the game says how fast that is). Bacteria don't see it.
import { DIRTBALL, GADGETS, KLAYMAN, SHOT } from './config.js';
import { dist, keepOnSoil } from './world.js';

const REACH = SHOT.range * 0.8;            // it throws from this close
const PUSH_REACH = KLAYMAN.radius + DIRTBALL.radius + 4;

export class AiKlay {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = 0;                  // seconds since it blinked up
    this.aim = { x: 0, y: 1 };
    this.facing = 'front';
    this.flip = false;
    this.moving = false;
    this.cooldown = 0;
    this.action = null;          // { kind: 'attack' | 'push', t }
    this.walkT = 0;
  }

  get spec() { return GADGETS.ai; }
  get gone() { return this.t >= this.spec.time; }
  /** At work: blinked up, and not yet blinking out. */
  get working() { return this.t >= this.spec.blink && this.t <= this.spec.time - this.spec.blink; }

  lookAlong(d) {
    const len = Math.hypot(d.x, d.y);
    if (!len) return;
    this.aim = { x: d.x / len, y: d.y / len };
    if (Math.abs(this.aim.x) > Math.abs(this.aim.y)) {
      this.facing = 'side';
      this.flip = this.aim.x < 0;
    } else {
      this.facing = this.aim.y > 0 ? 'front' : 'back';
    }
  }

  /** `game`: the game (for what's about, and to throw and push); `speed`,
   *  `fireRate`: how fast it walks (world units a second) and throws. */
  update(dt, game, { speed, fireRate }) {
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.action) {
      this.action.t += dt;
      if (this.action.t > KLAYMAN.actionTime) this.action = null;
    }
    this.moving = false;
    if (!this.working) return;
    const prey = game.nearestOf(game.bacteria.filter((b) => b.alive), this);
    const ball = game.nearestOf(game.dirtballs.filter((d) => d.solid && d.state === 'idle'), this);
    const pick = ball && (!prey || dist(ball, this) < dist(prey, this)) ? ball : prey;
    if (!pick) return;
    if (pick === ball) {
      // Round behind the dirtball, then push it at the nearest bacteria (or
      // the boss; with neither, away from the sprout).
      const at = prey ?? game.boss ?? { x: ball.x + (ball.x - game.tree.x), y: ball.y + (ball.y - game.tree.y) };
      const dx = at.x - ball.x;
      const dy = at.y - ball.y;
      const d = Math.hypot(dx, dy) || 1;
      const behind = { x: ball.x - (dx / d) * (PUSH_REACH - 2), y: ball.y - (dy / d) * (PUSH_REACH - 2) };
      if (dist(this, behind) > 5) {
        this.walkTo(behind, dt, speed);
      } else {
        this.lookAlong({ x: dx, y: dy });
        ball.push({ x: dx, y: dy });
        this.action = { kind: 'push', t: 0 };
        game.emit('push', { x: ball.x, y: ball.y, ai: true });
      }
      return;
    }
    // A bacteria: close enough, then dirt at it.
    if (dist(this, prey) > REACH) {
      this.walkTo(prey, dt, speed);
      return;
    }
    this.lookAlong({ x: prey.x - this.x, y: prey.y - this.y });
    if (this.cooldown > 0) return;
    this.cooldown = KLAYMAN.attackCooldown / fireRate;
    this.action = { kind: 'attack', t: 0 };
    game.aiThrow(this, this.aim);
  }

  walkTo(p, dt, speed) {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, speed * dt);
    this.lookAlong({ x: dx, y: dy });
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    keepOnSoil(this, KLAYMAN.radius);
    this.moving = true;
    this.walkT += dt;
  }
}

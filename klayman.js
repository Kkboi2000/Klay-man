// Ported from klayman.gd: moves, faces front/back/side, and one button either
// pushes the dirtball in front of him or throws dirt.
import { KLAYMAN, POISON } from './config.js';
import { keepOnSoil } from './world.js';

const FACING_DIR = {
  front: { x: 0, y: 1 },
  back: { x: 0, y: -1 },
};

export class Klayman {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.facing = 'front';
    this.flip = false;           // side frames face right; flip to face left
    this.moving = false;
    this.cooldown = 0;
    this.action = null;          // { kind: 'attack' | 'push', t }
    this.stun = 0;
    this.slow = 0;
    this.t = 0;
    this.tapBuffer = 0;          // a tap during the cooldown still counts
  }

  get poisoned() { return this.stun > 0 || this.slow > 0; }

  /** How green to draw him: 1 while poisoned, fading out at the end. */
  get greenness() {
    if (this.stun > 0) return 1;
    return Math.min(1, this.slow / 0.4);
  }

  /** A bacteria got inside him. Returns false if he is already poisoned. */
  poison() {
    if (this.poisoned) return false;
    this.stun = POISON.stun;
    this.slow = POISON.slow;
    return true;
  }

  facingDir() {
    if (this.facing === 'side') return { x: this.flip ? -1 : 1, y: 0 };
    return FACING_DIR[this.facing];
  }

  update(dt, input, game) {
    this.t += dt;
    if (this.stun > 0) this.stun = Math.max(0, this.stun - dt);
    else if (this.slow > 0) this.slow = Math.max(0, this.slow - dt);
    if (this.cooldown > 0) this.cooldown -= dt;
    if (input.pressed) this.tapBuffer = 0.3;
    else if (this.tapBuffer > 0) this.tapBuffer -= dt;
    if (this.action) {
      this.action.t += dt;
      if (this.action.t >= KLAYMAN.actionTime) this.action = null;
    }

    // Stunned: can't move or throw for a moment.
    if (this.stun > 0) {
      this.moving = false;
      return;
    }

    const slowFactor = this.slow > 0 ? POISON.slowFactor : 1;
    const boost = game.boostFactor;

    let dx = input.x, dy = input.y;
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    if (this.moving) {
      dx /= len; dy /= len;
      const speed = KLAYMAN.speed * slowFactor * boost;
      this.x += dx * speed * dt;
      this.y += dy * speed * dt;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = 'side';
        this.flip = dx < 0;
      } else if (dy < 0) {
        this.facing = 'back';
        this.flip = false;
      } else {
        this.facing = 'front';
        this.flip = false;
      }
    }
    keepOnSoil(this, 14);
    game.pushOutOfObstacles(this, KLAYMAN.radius);

    // Up close, the button pushes a dirtball. Auto throw never pushes: it
    // waits while a dirtball is right in front, so pushing stays your call.
    const wantsAction = this.tapBuffer > 0 || input.held;
    if ((wantsAction || input.auto) && this.cooldown <= 0) {
      const dir = this.facingDir();
      const ball = game.dirtballInFront(this, dir);
      if (ball && !wantsAction) return;
      this.cooldown = (KLAYMAN.attackCooldown / boost) / slowFactor;
      this.tapBuffer = 0;
      if (ball) {
        ball.push(dir);
        this.action = { kind: 'push', t: 0 };
        game.emit('push', { x: ball.x, y: ball.y });
      } else {
        this.action = { kind: 'attack', t: 0 };
        game.spawnShot(this.x + dir.x * 12, this.y + dir.y * 12 + (dir.y < 0 ? -2 : 0), dir);
      }
    }
  }
}

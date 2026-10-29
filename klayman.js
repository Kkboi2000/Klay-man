// Ported from klayman.gd: moves, aims, throws dirt, and pushes a dirtball he
// is touching. One button does both (the K button on a phone, Space or a
// click on a computer): it pushes when he's touching a dirtball and throws
// otherwise. Auto throw does both by itself. How fast he walks and throws
// is the game's to say (game.walkSpeed, game.fireRate): his tools, the bag
// and the booster all count there.
//
// He aims all the way round, not just four ways: at the dirt gun's target;
// else the way the K button is dragged (a phone), or at the closest bacteria
// while it's pressed without dragging; else at the mouse (a computer); else
// the way he last walked. His picture turns to the nearest of front, back
// and side.
import { KLAYMAN, POISON } from './config.js';
import { keepOnSoil } from './world.js';

const BUFFER = 0.3;              // seconds a press waits for the cooldown

export class Klayman {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.facing = 'front';       // which picture: front, back or side
    this.flip = false;           // side frames face right; flip to face left
    this.moving = false;
    this.cooldown = 0;
    this.action = null;          // { kind: 'attack' | 'push', t }
    this.stun = 0;
    this.slow = 0;
    this.t = 0;
    this.tapBuffer = 0;          // a press during the cooldown still counts
    this.heading = { x: 0, y: 1 }; // the way he last walked, any angle
    this.aim = { x: 0, y: 1 };   // the way he throws, any angle
    this.steering = false;       // aimed by hand with the K button right now
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

  /** The way his picture faces, as a step: right, left, down or up. */
  facingDir() {
    if (this.facing === 'side') return { x: this.flip ? -1 : 1, y: 0 };
    return this.facing === 'back' ? { x: 0, y: -1 } : { x: 0, y: 1 };
  }

  /** Turns his picture toward a direction: side, front or back, whichever is closest. */
  turnTo(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = 'side';
      this.flip = dx < 0;
    } else {
      this.facing = dy < 0 ? 'back' : 'front';
      this.flip = false;
    }
  }

  /** Aims along `dir` (any length) and turns to it. */
  lookAlong(dir) {
    const d = Math.hypot(dir.x, dir.y);
    if (d < 0.001) return;
    this.aim = { x: dir.x / d, y: dir.y / d };
    this.turnTo(dir.x, dir.y);
  }

  /** Aims at a point in the pot. */
  lookAt(p) {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    if (Math.hypot(dx, dy) < 1) return;
    this.lookAlong({ x: dx, y: dy });
  }

  update(dt, input, game) {
    this.t += dt;
    if (this.stun > 0) this.stun = Math.max(0, this.stun - dt);
    else if (this.slow > 0) this.slow = Math.max(0, this.slow - dt);
    if (this.cooldown > 0) this.cooldown -= dt;
    this.tapBuffer = input.pressed ? BUFFER : Math.max(0, this.tapBuffer - dt);
    if (this.action) {
      this.action.t += dt;
      if (this.action.t >= KLAYMAN.actionTime) this.action = null;
    }

    // Stunned, or digging with the shovel: no walking or throwing for a moment.
    this.steering = false;
    if (this.stun > 0 || game.digging) {
      this.moving = false;
      return;
    }

    const slowFactor = this.slow > 0 ? POISON.slowFactor : 1;
    const gear = game.gear;

    let dx = input.x, dy = input.y;
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    if (this.moving) {
      dx /= len; dy /= len;
      const speed = KLAYMAN.speed * slowFactor * game.walkSpeed;
      this.x += dx * speed * dt;
      this.y += dy * speed * dt;
      this.heading = { x: dx, y: dy };
    }
    keepOnSoil(this, 14);
    game.pushOutOfObstacles(this, KLAYMAN.radius, !gear.passSprout);

    // The dirt gun keeps him on its target, walking or not. Otherwise the K
    // button steers him (or, pressed without dragging, finds the closest
    // bacteria), or the mouse does (on a computer), or he aims the way he walks.
    const target = game.lock;
    this.steering = Boolean(input.steer) && !target;
    const sought = target || this.steering || !input.seek ? null : game.nearestBacteria(this);
    const goal = target ?? sought;
    const point = goal ? (goal.aimPoint ?? goal) : this.steering ? null : input.aim;
    if (point) this.lookAt(point);
    else if (this.steering) this.lookAlong(input.steer);
    else if (this.moving) this.lookAlong(this.heading);
    if (this.cooldown > 0 || !(this.tapBuffer > 0 || input.held || input.auto)) return;

    // Only a dirtball he is touching can be pushed: the one he aims at, or
    // (aiming elsewhere) the one he walked into.
    let dir = this.aim;
    let ball = game.dirtballTouching(this, dir);
    if (!ball && (point || this.steering)) {
      ball = game.dirtballTouching(this, this.heading);
      if (ball) dir = this.heading;
    }

    this.cooldown = KLAYMAN.attackCooldown / game.fireRate / slowFactor;
    this.tapBuffer = 0;
    if (ball) {
      ball.push(dir);
      this.action = { kind: 'push', t: 0 };
      game.emit('push', { x: ball.x, y: ball.y });
      return;
    }
    const a = this.aim;
    const from = { x: this.x + a.x * 12, y: this.y + a.y * 12 + (a.y < -0.5 ? -2 : 0) };
    let shot = a;
    if (target) {
      const ax = point.x - from.x;
      const ay = point.y - from.y;
      const d = Math.hypot(ax, ay) || 1;
      shot = { x: ax / d, y: ay / d };
    }
    this.action = { kind: 'attack', t: 0 };
    game.spawnShot(from.x, from.y, shot, target);
  }
}

// The rules of Klayman. No drawing, no sound, no DOM: the game only changes
// numbers and announces what happened through events, so it can be tested.
import {
  BACTERIA, BOSS, COINS, DIRTBALL, GADGETS, ITEMS, KLAYMAN, LEVELS, LOOKAHEAD, REVIVE, SCORE, SHOT, TOOLS, TREE,
} from './config.js';
import {
  RING_SQUASH, TREE_SPOT, dist, insideRing, insideSoil, keepOnSoil, randomSpotNear, randomSpotOnSoil, rimPoint,
} from './world.js';
import { Klayman } from './klayman.js';
import { Bacteria } from './bacteria.js';
import { Dirtball } from './dirtball.js';
import { DirtShot } from './dirtshot.js';
import { Boss, bossHp, bossSpawnEvery, isBossLevel } from './boss.js';
import { Gadget } from './gadgets.js';
import { Coin, Item, pickItem } from './items.js';
import { gearFor } from './gear.js';

/** x, y: which way to walk. pressed/held: the action button (the K button on
 *  a phone, Space or a click on a computer): it pushes a dirtball Klayman is
 *  touching, and throws otherwise. auto: auto throw (and push). aim: a point
 *  in the pot to aim at (the mouse, on a computer), or null to aim the way
 *  he walks. gadget: which gadget to use this step (0 or 1), or -1. */
export const NO_INPUT = Object.freeze({ x: 0, y: 0, pressed: false, held: false, auto: false, aim: null, gadget: -1 });

// Where a flower's head is, above the spot it's rooted in (unscaled).
const FLOWER_TOP = { sunflower: 54, daisy: 50 };

// A boss rises at one of the pot's four corners, BOSS.corner in from the rim.
const BOSS_CORNERS = [-3, -1, 1, 3].map((k) => (k * Math.PI) / 4);

/** Moves `a` out of `b` until they are at least `minD` apart. */
function separate(a, b, minD, share = 1) {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let d = Math.hypot(dx, dy);
  if (d >= minD) return;
  if (d < 0.001) { dx = 1; dy = 0; d = 1; }
  const push = (minD - d) * share;
  a.x += (dx / d) * push;
  a.y += (dy / d) * push;
}

/** Moves `p` out of a flat oval round `c` (rx across, ry deep). */
function pushOutOfOval(p, c, rx, ry) {
  let dx = p.x - c.x;
  let dy = p.y - c.y;
  const k = Math.hypot(dx / rx, dy / ry);
  if (k >= 1) return false;
  if (k < 0.001) { dx = 0; dy = ry; }
  const edge = Math.hypot(dx / rx, dy / ry);
  p.x = c.x + dx / edge;
  p.y = c.y + dy / edge;
  return true;
}

/** A place special items come from: the pot (near the sprout, from level
 *  3) or a sunflower (out of its flower, from level 1). Each keeps one item
 *  out at a time, and knows the next one a little early, for the glasses. */
function itemSource(kind, every) {
  return { kind, every, timer: every, next: null, out: null };
}

export class Game {
  /** `loadout` is { tools, sprouts, gadgets }: what the player picked on the
   *  setup page. sprouts[1], if there is one, is the backup. */
  constructor({ rng = Math.random, loadout } = {}) {
    this.rng = rng;
    this.events = [];
    this.reset(loadout);
  }

  /** A new game. `level` is where it starts (a level skip, or admin mode). */
  reset(loadout = this.loadout, level = 1) {
    this.loadout = {
      tools: [...(loadout?.tools ?? [])],
      sprouts: loadout?.sprouts?.length ? [...loadout.sprouts] : ['sprout'],
      gadgets: [...new Set(loadout?.gadgets ?? [])].filter((id) => GADGETS[id]),
    };
    this.items = [];               // special items out on the soil (or flying)
    this.potItems = itemSource('pot', ITEMS.every);
    this.sproutIndex = 0;
    this.plant(this.loadout.sprouts[0]);
    this.klay = new Klayman(TREE_SPOT.x, TREE_SPOT.y + 62);
    this.tree = { x: TREE_SPOT.x, y: TREE_SPOT.y };
    this.bacteria = [];
    this.dirtballs = [];
    this.shots = [];
    this.coins = [];
    this.gadgets = this.loadout.gadgets.map((id) => new Gadget(id));
    this.lock = null;              // the dirt gun's target: the closest thing it can hit
    this.upcoming = [];            // where the next bacteria will appear, soonest first (the glasses show them)
    this.nextCoin = null;          // ...and the next 1K coin
    this.score = 0;
    this.earned = 0;               // coins (K) picked up this game
    this.boost = 0;
    this.freeze = 0;
    this.coinTimer = COINS.every;
    this.over = false;
    this.resumeTo = null;
    this.revivesLeft = REVIVE.perGame;
    this.events.length = 0;
    this.startLevel(level);
  }

  /** Puts a sprout in the pot: its hearts and its powers' clocks. */
  plant(sprout) {
    this.gear = gearFor({ tools: this.loadout.tools, sprout });
    const g = this.gear;
    this.lives = g.lives;
    this.maxLives = g.lives;
    this.treeHurt = 0;
    this.flowerItems = g.itemEvery ? itemSource('flower', g.itemEvery) : null;
    this.flowerCoins = g.coinEvery ? { every: g.coinEvery, timer: g.coinEvery, next: null } : null;
    this.healTimer = g.heal?.every;
    this.sporeTimer = g.spores?.every;
    this.growTimer = g.growEvery;
    this.shieldTimer = g.shield?.every;
    this.shield = 0;               // corn: seconds left with its leaves closed
    this.hideTimer = g.hide?.every;
    this.hidden = 0;               // lilies: seconds left closed
  }

  // ---------------------------------------------------------------- state

  get boostFactor() { return this.boost > 0 ? ITEMS.bagBoost : 1; }

  /** The syringe: 'boost' for its first 5 seconds, 'crash' for the 2 after, else null. */
  get syringe() {
    const g = this.gadgets.find((x) => x.id === 'syringe' && x.active);
    if (!g) return null;
    return g.t < g.spec.boost.time ? 'boost' : 'crash';
  }
  /** What the syringe does to his throws right now (nothing, when it isn't working). */
  get syringeEffect() { return GADGETS.syringe[this.syringe] ?? {}; }
  /** How much quicker than plain he throws: his tools, and the syringe. */
  get fireRate() { return this.gear.fireRate * (this.syringeEffect.fireRate ?? 1); }
  /** How much dirt a throw puts on: the bag, and the syringe. */
  get dirtPower() { return this.boostFactor * (this.syringeEffect.dirt ?? 1); }
  get frozen() { return this.freeze > 0; }
  get itemsUnlocked() { return this.level >= ITEMS.unlockLevel; }
  /** Level 7 skill: dirt thrown from a distance breaks a dirtball. */
  get skillUnlocked() { return this.level >= KLAYMAN.skillLevel; }
  /** How much bigger the sprout has grown (water drops, a mushroom growing). */
  get treeScale() { return 1 + TREE.growPerWater * (this.maxLives - this.gear.lives); }
  /** Bacteria can't get into the sprout: corn's leaves are closed, or a lily is. */
  get sproutClosed() { return this.shield > 0 || this.hidden > 0; }
  /** This level ends with a boss bacteria. */
  get bossLevel() { return isBossLevel(this.level); }
  /** A boss is out (or rumbling up): thrown dirt doesn't break dirtballs
   *  then; they're for pushing into it. */
  get bossTime() { return Boolean(this.boss || this.bossPlan); }
  /** Dirt thrown at a dirtball breaks it: from level 7, but not while a boss is out. */
  get shotsBreakBalls() { return this.skillUnlocked && !this.bossTime; }
  /** Klayman is digging with the shovel: he stands still till he's done. */
  get digging() { return this.gadgets.some((g) => g.id === 'shovel' && g.active); }

  /** The sprout's powers and the seconds until each comes round (what the
   *  glasses show by the sprout). Corn and lilies count down to closing,
   *  then, while closed, to opening again. */
  get sproutClocks() {
    const g = this.gear;
    const out = [];
    if (this.flowerCoins) out.push({ power: 'coin', secs: this.flowerCoins.timer });
    if (this.flowerItems) out.push({ power: 'item', secs: this.flowerItems.timer });
    if (g.shield) out.push(this.shield > 0 ? { power: 'opens', secs: this.shield } : { power: 'closes', secs: this.shieldTimer });
    if (g.hide) out.push(this.hidden > 0 ? { power: 'opens', secs: this.hidden } : { power: 'closes', secs: this.hideTimer });
    if (g.spores) out.push({ power: 'spores', secs: this.sporeTimer });
    if (g.heal) out.push({ power: 'heal', secs: this.healTimer });
    if (g.growEvery && this.maxLives < g.maxLives) out.push({ power: 'grow', secs: this.growTimer });
    return out;
  }

  /** Bacteria still to beat this level: to come, crawling or dirty, inside
   *  a dirtball, and the boss until it's worn out. */
  get bacteriaLeft() {
    const alive = this.bacteria.filter((b) => b.alive).length;
    const balls = this.dirtballs.filter((d) => d.state !== 'breaking').length;
    const boss = this.bossLevel && !this.bossBeaten && !(this.boss && !this.boss.alive) ? 1 : 0;
    return this.toSpawn + alive + balls + boss;
  }

  /** Seconds until the next bacteria appears (the level banner counts too). */
  get untilSpawn() {
    return (this.phase === 'banner' ? this.phaseT : 0) + this.spawnTimer;
  }

  /** Seconds until the `i`th bacteria from now appears (0 is the next one). */
  untilUpcoming(i) { return this.untilSpawn + i * this.spawnEvery; }

  levelSize(n) { return LEVELS.firstCount + LEVELS.extraPerLevel * (n - 1); }

  spawnEveryFor(n) {
    const plain = Math.max(LEVELS.minSpawnEvery, LEVELS.spawnEvery - LEVELS.spawnEveryStep * (n - 1));
    return plain / LEVELS.spawnRate;
  }

  bacteriaSpeed(n) {
    const factor = Math.min(BACTERIA.maxSpeedFactor, BACTERIA.levelSpeedUp ** (n - 1));
    return BACTERIA.speed * factor;
  }

  /** Where special items come from right now: the pot (from level 3) and a sunflower. */
  get itemSources() {
    return [this.itemsUnlocked ? this.potItems : null, this.flowerItems].filter(Boolean);
  }

  /** How far the leaf's wind reaches round Klayman now (0 when it's not blowing). */
  get windReach() {
    const g = this.gadgets.find((x) => x.id === 'leaf' && x.active);
    if (!g) return 0;
    return g.spec.reach * Math.min(1, g.t / g.spec.grow, g.on / 0.25);
  }

  /** Every bacteria's speed, now: slower while the fertilizer works. */
  get pace() {
    const fed = this.gadgets.some((g) => g.id === 'fertilizer' && g.active);
    return fed ? GADGETS.fertilizer.slowFactor : 1;
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  // -------------------------------------------------------------- levels

  startLevel(n) {
    this.level = n;
    this.toSpawn = this.levelSize(n);
    this.spawnEvery = this.spawnEveryFor(n);
    this.spawnTimer = 0.4;
    this.upcoming = [];
    this.boss = null;
    this.bossPlan = null;          // where the boss will rise, while the ground rumbles
    this.bossWarn = 0;
    this.bossBeaten = false;
    this.phase = 'banner';
    this.phaseT = LEVELS.bannerTime;
    const unlocksItems = n === ITEMS.unlockLevel;
    const unlocksSkill = n === KLAYMAN.skillLevel;
    if (unlocksItems) this.potItems.timer = ITEMS.every;
    this.emit('level', { level: n, unlocksItems, unlocksSkill, boss: isBossLevel(n), firstBoss: n === BOSS.firstLevel });
  }

  /** A spot on the rim, not right next to Klayman. */
  planBacteria() {
    let p = rimPoint(this.rng() * Math.PI * 2, 12);
    for (let i = 0; i < 12 && dist(p, this.klay) < 90; i++) {
      p = rimPoint(this.rng() * Math.PI * 2, 12);
    }
    return p;
  }

  spawnOne() {
    const p = this.upcoming.shift() ?? this.planBacteria();
    const b = this.addBacteria(p.x, p.y);
    this.emit('spawn', { x: b.x, y: b.y });
  }

  addBacteria(x, y) {
    const b = new Bacteria(x, y, this.bacteriaSpeed(this.level));
    this.bacteria.push(b);
    return b;
  }

  addDirtball(x, y) {
    const d = new Dirtball(x, y);
    this.dirtballs.push(d);
    return d;
  }

  // ------------------------------------------------------------- the boss

  /** One of the pot's four corners, at random, but not where Klayman stands. */
  planBoss() {
    const corners = BOSS_CORNERS.map((a) => rimPoint(a, BOSS.corner));
    const clear = corners.filter((c) => dist(c, this.klay) > 220);
    const pool = clear.length ? clear : corners;
    return pool[Math.floor(this.rng() * pool.length) % pool.length];
  }

  /** The level's own bacteria are gone: the ground rumbles where the boss will rise. */
  callBoss() {
    this.bossPlan = this.planBoss();
    this.bossWarn = BOSS.warn;
    this.emit('bossComing', { ...this.bossPlan });
  }

  raiseBoss() {
    const { x, y } = this.bossPlan;
    this.boss = new Boss(x, y, { hp: bossHp(this.level), spawnEvery: bossSpawnEvery(this.level) });
    this.bossPlan = null;
    this.emit('bossRises', { x, y });
  }

  /** The boss sends a bacteria out of its side facing the sprout. */
  bossSpawn() {
    const b = this.boss;
    const c = b.aimPoint;
    const toward = Math.atan2(this.tree.y - c.y, this.tree.x - c.x);
    const a = toward + (this.rng() - 0.5) * 1.6;
    const p = { x: c.x + Math.cos(a) * (BOSS.foot.rx + 6), y: c.y + Math.sin(a) * (BOSS.foot.ry + 6) };
    keepOnSoil(p, 12);
    this.addBacteria(p.x, p.y);
    this.emit('bossSpawn', { x: p.x, y: p.y });
  }

  /** Dirt lands on the boss: a throw, or a rolling dirtball. */
  hitBoss(damage, at) {
    const boss = this.boss;
    const down = boss.hit(damage);
    this.emit('bossHit', { x: at.x, y: at.y, damage, hp: boss.hp, maxHp: boss.maxHp });
    if (!down) return;
    this.addScore(SCORE.boss, { x: boss.x, y: boss.y - 140 });
    this.emit('bossDown', { x: boss.x, y: boss.y });
  }

  updateBoss(dt) {
    if (this.bossPlan) {
      this.bossWarn -= dt;
      if (this.bossWarn <= 0) this.raiseBoss();
    }
    const boss = this.boss;
    if (!boss) return;
    const was = boss.state;
    if (boss.update(dt, this.frozen)) this.bossSpawn();
    if (boss.state === 'burrowing' && was !== 'burrowing') this.emit('bossBurrows', { x: boss.x, y: boss.y });
    if (!boss.gone) return;
    // Back in the ground: a big coin pops out where it stood.
    this.boss = null;
    this.bossBeaten = true;
    const spot = { x: boss.x, y: boss.y + 28 };
    keepOnSoil(spot, 24);
    this.dropCoin(spot, BOSS.coin, { x: boss.x, y: boss.y, ground: boss.y });
  }

  /** Keeps a spot (for a coin) out from under the boss. */
  clearOfBoss(p, pad = 16) {
    if (this.boss?.solid) this.boss.pushOut(p, pad);
    if (this.bossPlan) {
      const ghost = new Boss(this.bossPlan.x, this.bossPlan.y, { hp: 1, spawnEvery: 1 });
      ghost.pushOut(p, pad);
    }
    return p;
  }

  // ------------------------------------------------- asked for by Klayman

  /** The dirtball Klayman is touching on the side `dir` points to, if any.
   *  He has to be right up against it: no pushing from a step away. */
  dirtballTouching(k, dir) {
    const reach = KLAYMAN.radius + DIRTBALL.radius + KLAYMAN.pushGap;
    let best = null;
    let bestD = Infinity;
    for (const b of this.dirtballs) {
      if (!b.solid) continue;
      const dx = b.x - k.x;
      const dy = b.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 0.001) continue;
      if ((dx * dir.x + dy * dir.y) / d < KLAYMAN.pushCone) continue;
      if (d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  get shotRange() { return SHOT.range * this.gear.range * (this.syringeEffect.range ?? 1); }

  spawnShot(x, y, dir, target = null) {
    const shot = new DirtShot(x, y, dir, { range: this.shotRange, target });
    shot.gun = this.gear.lockOn;
    this.shots.push(shot);
    this.emit('throw', { x, y, gun: this.gear.lockOn });
  }

  /** The dirt gun's pick: the nearest thing a shot can reach and hurt. A
   *  bacteria, the boss (measured to its edge) and, when dirt breaks them
   *  (from level 7, but not while a boss is out), a dirtball. */
  lockTarget(from) {
    let best = null;
    let bestD = this.shotRange;
    const consider = (t, d) => { if (d < bestD) { best = t; bestD = d; } };
    for (const b of this.bacteria) if (b.lockable) consider(b, dist(b, from));
    if (this.boss?.lockable) consider(this.boss, this.boss.gap(from));
    if (this.shotsBreakBalls) for (const d of this.dirtballs) if (d.lockable) consider(d, dist(d, from));
    return best;
  }

  pushOutOfObstacles(p, r, sproutBlocks = true) {
    for (const b of this.dirtballs) {
      if (b.solid) separate(p, b, r + DIRTBALL.radius);
    }
    if (this.boss?.solid) this.boss.pushOut(p, r);
    if (sproutBlocks) separate(p, this.tree, r + TREE.radius * 0.6);
  }

  // -------------------------------------------------------------- update

  update(dt, input = NO_INPUT) {
    if (this.over) return;
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt);
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    if (this.treeHurt > 0) this.treeHurt = Math.max(0, this.treeHurt - dt);

    this.updateGadgets(dt, input.gadget ?? -1);
    this.lock = this.gear.lockOn ? this.lockTarget(this.klay) : null;
    this.klay.update(dt, input, this);
    this.updateShots(dt);
    this.updateBacteria(dt);
    if (this.over) return;
    this.updateDirtballs(dt);
    this.updateBoss(dt);
    this.updateItems(dt);
    this.updateCoins(dt);
    this.updateSprout(dt);
    this.updateFlow(dt);
  }

  updateShots(dt) {
    const boss = this.boss;
    for (const s of this.shots) {
      s.update(dt, this.bacteria);
      if (s.dead) continue;
      for (const b of this.bacteria) {
        if (!b.alive) continue;
        if (dist(b, s) < BACTERIA.radius + SHOT.radius) {
          s.dead = true;
          this.emit('hit', { x: b.x, y: b.y });
          if (b.addDirt(this.dirtPower)) this.turnIntoDirtball(b);
          break;
        }
      }
      if (s.dead) continue;
      // Dirt splats on the boss; while it's still fighting, it wears it down.
      if (boss?.solid && boss.touches(s, SHOT.radius)) {
        s.dead = true;
        if (boss.alive) this.hitBoss(BOSS.shotDamage * this.dirtPower, s);
        else this.emit('hit', { x: s.x, y: s.y });
        continue;
      }
      if (!this.shotsBreakBalls) continue;
      // Before level 7, or while a boss is out, dirt flies past dirtballs. Otherwise it breaks them.
      const ball = this.dirtballs.find((d) => d.solid && dist(d, s) < DIRTBALL.radius + SHOT.radius);
      if (ball) {
        s.dead = true;
        this.breakDirtball(ball);
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  turnIntoDirtball(b) {
    b.state = 'gone';
    b.dead = true;
    const ball = this.addDirtball(b.x, b.y);
    this.emit('dirtball', { x: b.x, y: b.y });
    return ball;
  }

  updateBacteria(dt) {
    const frozen = this.frozen;
    const closed = this.sproutClosed;
    const coat = TOOLS.coat;
    const pace = this.pace;
    const wind = this.windReach;
    // A closed lily can't be seen: bacteria wander instead of heading for it.
    const target = this.hidden > 0 ? null : this.tree;
    for (const b of this.bacteria) {
      b.update(dt, target, frozen, this.tree, pace);
      // The leaf's wind: nothing gets through to Klayman.
      if (wind > 0 && b.alive) this.blowAway(b, wind);
      if (!b.crawling || frozen) continue;

      if (!closed && dist(b, this.tree) < TREE.radius + 4) {
        b.absorbInto(this.tree);
        this.hurtTree();
        if (this.over) return;
        continue;
      }
      if (dist(b, this.klay) >= BACTERIA.radius + KLAYMAN.radius - 4) continue;
      if (this.gear.immune) {
        // The lab coat keeps it out, and a touch slows it down.
        if (b.slowDown(coat.slowTime, coat.slowFactor)) this.emit('slowed', { x: b.x, y: b.y });
      } else if (!this.klay.poisoned) {
        // A healthy Klayman swallows the bacteria and turns green.
        // While he's green, bacteria crawl straight past him.
        b.absorbInto(this.klay);
        this.klay.poison();
        this.emit('poison', { x: this.klay.x, y: this.klay.y });
      }
    }

    if (!frozen) {
      const crawlers = this.bacteria.filter((b) => b.crawling);
      for (let i = 0; i < crawlers.length; i++) {
        for (let j = i + 1; j < crawlers.length; j++) {
          separate(crawlers[i], crawlers[j], BACTERIA.radius * 1.7, 0.5);
          separate(crawlers[j], crawlers[i], BACTERIA.radius * 1.7, 0.5);
        }
      }
      for (const c of crawlers) {
        for (const o of this.bacteria) {
          if (o.state === 'dirty') separate(c, o, BACTERIA.radius * 1.8);
        }
        for (const d of this.dirtballs) {
          if (d.solid) separate(c, d, BACTERIA.radius + DIRTBALL.radius);
        }
        // The boss stands its ground: they crawl round it.
        if (this.boss?.solid) this.boss.pushOut(c, BACTERIA.radius);
        // A closed sprout is a wall: they bump into it and wait.
        if (closed) separate(c, this.tree, TREE.radius + 8);
        keepOnSoil(c, 6);
      }
    }
    this.bacteria = this.bacteria.filter((b) => !b.dead);
  }

  /** The leaf's wind holds a bacteria outside its ring round Klayman. */
  blowAway(b, reach) {
    const r = reach + BACTERIA.radius;
    if (pushOutOfOval(b, this.klay, r, reach * RING_SQUASH + BACTERIA.radius)) keepOnSoil(b, 6);
  }

  hurtTree() {
    this.lives = Math.max(0, this.lives - 1);
    this.treeHurt = 0.5;
    this.emit('treeHurt', { lives: this.lives });
    if (this.lives <= 0) this.gameOver();
  }

  updateDirtballs(dt) {
    const boss = this.boss;
    for (const d of this.dirtballs) {
      d.update(dt, this.frozen);

      if (d.state === 'idle') {
        if (boss?.solid) boss.pushOut(d, DIRTBALL.radius);
        if (d.knock > 0) keepOnSoil(d, 10);
      }
      if (d.state === 'idle' && d.cracked) {
        // Held too long: it cracks and a very dirty bacteria climbs out.
        d.dead = true;
        this.addBacteria(d.x, d.y).setDirtStage(BACTERIA.maxDirt - 1);
        this.emit('crack', { x: d.x, y: d.y });
        continue;
      }
      if (d.state !== 'rolling') continue;

      if (!insideSoil(d.x, d.y, 8)) { this.breakDirtball(d); continue; }
      if (dist(d, this.tree) < DIRTBALL.radius + TREE.radius * 0.6) { this.breakDirtball(d); continue; }

      // A rolling dirtball hits the boss hard, and breaks.
      if (boss?.solid && boss.touches(d, DIRTBALL.radius)) {
        if (boss.alive) this.hitBoss(BOSS.ballDamage, d);
        this.breakDirtball(d);
        continue;
      }

      const victim = this.bacteria.find((b) => b.alive && dist(b, d) < DIRTBALL.radius + BACTERIA.radius - 2);
      if (victim) {
        victim.breakApart();
        this.addScore(SCORE.smash, victim);
        this.emit('smash', { x: victim.x, y: victim.y });
        this.killed(victim);
        this.breakDirtball(d);
        continue;
      }

      const other = this.dirtballs.find((o) => o !== d && !o.dead && o.state !== 'breaking'
        && dist(o, d) < DIRTBALL.radius * 2 - 2);
      if (other) {
        this.breakDirtball(d);
        this.breakDirtball(other);
      }
    }
    this.dirtballs = this.dirtballs.filter((d) => !d.dead);
  }

  /** A dirtball breaking kills the bacteria inside it. */
  breakDirtball(d) {
    if (!d.breakApart()) return;
    this.addScore(SCORE.dirtball, d);
    this.emit('break', { x: d.x, y: d.y });
    this.killed(d);
  }

  /** Every kill has a chance to drop a 5K coin where it happened. */
  killed(at) {
    if (this.rng() >= COINS.dropChance) return;
    const spot = { x: at.x, y: at.y };
    keepOnSoil(spot, 24);
    this.dropCoin(this.clearOfBoss(spot), COINS.dropValue);
  }

  addScore(points, at) {
    this.score += points;
    this.emit('score', { points, x: at.x, y: at.y });
  }

  // ---------------------------------------------------------------- items

  /** Where a flower's head is right now (it grows with the sprout). */
  get flowerTop() {
    const top = FLOWER_TOP[this.gear.sprout] ?? FLOWER_TOP.sunflower;
    return { x: this.tree.x, y: this.tree.y - top * this.treeScale };
  }

  /** The next item from `source`: what it is, and where it lands (near the
   *  sprout, or close to a sunflower). Decided ahead, so the glasses can
   *  show it; what they show is what comes. */
  planItem(source) {
    const { min, max } = source.kind === 'flower' ? this.gear.drop : ITEMS.nearSprout;
    const spot = randomSpotNear(this.tree, min, max, this.rng, this.klay);
    const type = pickItem(this.lives, this.maxLives, this.rng, this.gear.maxLives);
    return { type, x: spot.x, y: spot.y };
  }

  updateItems(dt) {
    for (const item of this.items) {
      item.update(dt);
      if (item.landed && dist(item, this.klay) < ITEMS.pickupRadius) {
        item.taken = true;
        this.useItem(item);
      }
    }
    this.items = this.items.filter((item) => !item.taken && !item.gone);

    for (const source of this.itemSources) {
      if (source.out && !this.items.includes(source.out)) source.out = null;
      source.timer -= dt;
      if (!source.out && !source.next && source.timer <= LOOKAHEAD) source.next = this.planItem(source);
      if (source.timer > 0) continue;
      source.timer += source.every;
      if (!source.out) {
        const { type, x, y } = source.next ?? this.planItem(source);
        const from = source.kind === 'flower' ? this.flowerTop : null;
        const item = new Item(type, x, y, from);
        this.items.push(item);
        source.out = item;
        this.emit('itemAppears', { item: type, x, y, from });
      }
      source.next = null;
    }
  }

  useItem(item) {
    switch (item.type) {
      case 'plus':
        this.lives = Math.min(this.maxLives, this.lives + 1);
        break;
      case 'bag':
        this.boost = ITEMS.bagTime;
        break;
      case 'water':
        this.maxLives = Math.min(this.gear.maxLives, this.maxLives + 1);
        this.lives = Math.min(this.maxLives, this.lives + 1);
        break;
      case 'sandclock':
        this.freeze = ITEMS.sandclockTime;
        break;
    }
    this.emit('pickup', { item: item.type, x: item.x, y: item.y });
  }

  // ---------------------------------------------------------------- coins

  /** A daisy's next coin: where it lands, and what it's worth (1K, 5K or 10K). */
  planFlowerCoin() {
    const { min, max } = this.gear.drop;
    const spot = this.clearOfBoss(randomSpotNear(this.tree, min, max, this.rng, this.klay));
    const roll = this.rng();
    const { coins } = this.gear;
    let upTo = 0;
    const pick = coins.find((c) => roll < (upTo += c.chance)) ?? coins[coins.length - 1];
    return { x: spot.x, y: spot.y, value: pick.value };
  }

  updateCoins(dt) {
    this.coinTimer -= dt;
    // Where the next 1K coin lands is decided a little early, for the glasses.
    if (!this.nextCoin && this.coinTimer <= LOOKAHEAD) this.nextCoin = this.clearOfBoss(randomSpotOnSoil(this.rng));
    if (this.coinTimer <= 0) {
      this.coinTimer += COINS.every;
      this.dropCoin(this.nextCoin ?? this.clearOfBoss(randomSpotOnSoil(this.rng)), COINS.value);
      this.nextCoin = null;
    }
    // A daisy: a coin pops out of the flower, from level 1.
    const daisy = this.flowerCoins;
    if (daisy) {
      daisy.timer -= dt;
      if (!daisy.next && daisy.timer <= LOOKAHEAD) daisy.next = this.planFlowerCoin();
      if (daisy.timer <= 0) {
        daisy.timer += daisy.every;
        const c = daisy.next ?? this.planFlowerCoin();
        daisy.next = null;
        this.dropCoin(c, c.value, { ...this.flowerTop, ground: this.tree.y });
      }
    }
    const magnet = this.gear.magnet;
    for (const c of this.coins) {
      c.update(dt);
      if (!c.landed || c.gone) continue;
      // The backpack: coins close by come running.
      if (magnet && dist(c, this.klay) < magnet) c.pull(this.klay, dt);
      if (dist(c, this.klay) < COINS.pickupRadius) {
        c.taken = true;
        this.earned += c.value;
        this.emit('coin', { value: c.value, x: c.x, y: c.y });
      }
    }
    this.coins = this.coins.filter((c) => !c.taken && !c.gone);
  }

  /** A coin worth `value` K. `from`: where it flies out of first (a flower, the ground). */
  dropCoin(at, value, from = null) {
    this.coins.push(new Coin(at.x, at.y, value, COINS.lifetime, from));
    this.emit('coinAppears', { value, x: at.x, y: at.y, from });
  }

  // --------------------------------------------------------------- gadgets

  /** Uses gadget `i` (0 or 1) if it's ready. */
  useGadget(i) {
    const g = this.gadgets[i];
    if (this.over || !g?.use()) return false;
    const at = g.id === 'spray' ? this.tree : this.klay;
    this.emit('gadget', { id: g.id, index: i, x: at.x, y: at.y });
    return true;
  }

  updateGadgets(dt, pressed = -1) {
    if (pressed >= 0) this.useGadget(pressed);
    this.gadgets.forEach((g, index) => {
      const before = g.t;
      const running = g.active;
      const news = g.update(dt);
      if (running && g.id === 'spray') {
        // Two puffs of mist on the sprout; the second brings half a heart back.
        const { puffs, heal } = g.spec;
        puffs.forEach((at, n) => {
          if (before >= at || g.t < at) return;
          this.emit('mist', { x: this.tree.x, y: this.tree.y });
          if (n === puffs.length - 1) this.sprayHeal(heal);
        });
      }
      // The shovel: the moment the blade comes up full, dirt flies all round him.
      if (running && g.id === 'shovel' && before < g.spec.dig && g.t >= g.spec.dig) this.dig(g.spec);
      // The syringe wears off: he goes grey.
      const peak = g.spec.boost?.time;
      if (running && g.id === 'syringe' && before < peak && g.t >= peak) this.emit('syringeCrash', { x: this.klay.x, y: this.klay.y });
      if (news) this.emit(news === 'end' ? 'gadgetEnds' : 'gadgetReady', { id: g.id, index });
    });
  }

  /** Dirt flies over every bacteria in the ring round Klayman: one layer
   *  more each (one on its third becomes a dirtball). Dirtballs don't mind. */
  dig({ reach, dirt }) {
    const k = this.klay;
    for (const b of [...this.bacteria]) {
      if (!b.alive || !insideRing(b, k, reach)) continue;
      if (b.addDirt(dirt)) this.turnIntoDirtball(b);
    }
    this.emit('dig', { x: k.x, y: k.y, reach });
  }

  sprayHeal(amount) {
    const before = this.lives;
    this.lives = Math.min(this.maxLives, this.lives + amount);
    this.emit('sprayHeal', { x: this.tree.x, y: this.tree.y, amount: this.lives - before });
  }

  // --------------------------------------------------------- sprout powers

  updateSprout(dt) {
    const g = this.gear;
    const at = { x: this.tree.x, y: this.tree.y };
    if (this.shield > 0) {
      this.shield = Math.max(0, this.shield - dt);
      if (this.shield === 0) this.emit('unshield', at);
    }
    if (this.hidden > 0) {
      this.hidden = Math.max(0, this.hidden - dt);
      if (this.hidden === 0) this.emit('unhide', at);
    }

    if (g.heal) {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer += g.heal.every;
        if (this.lives < this.maxLives) {
          this.lives = Math.min(this.maxLives, this.lives + g.heal.amount);
          this.emit('heal', { ...at, amount: g.heal.amount });
        }
      }
    }
    if (g.spores) {
      this.sporeTimer -= dt;
      if (this.sporeTimer <= 0) {
        this.sporeTimer += g.spores.every;
        this.spores(g.spores);
        this.emit('spores', { ...at, reach: g.spores.reach });
      }
    }
    if (g.growEvery) {
      this.growTimer -= dt;
      if (this.growTimer <= 0) {
        this.growTimer += g.growEvery;
        if (this.maxLives < g.maxLives) {
          this.maxLives += 1;
          this.lives += 1;
          this.emit('grow', at);
        }
      }
    }
    if (g.shield) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldTimer += g.shield.every;
        this.shield = g.shield.time;
        this.emit('shield', at);
      }
    }
    if (g.hide) {
      this.hideTimer -= dt;
      if (this.hideTimer <= 0) {
        this.hideTimer += g.hide.every;
        this.hidden = g.hide.time;
        this.emit('hide', at);
      }
    }
  }

  /** A mushroom's spores: inside the ring, dirtballs slide away, and every
   *  bacteria (crawling or dirty) gets one more layer of dirt, is pushed
   *  back and slowed. One already three layers deep becomes a dirtball. */
  spores({ reach, push, dirt, slowTime, slowFactor }) {
    const t = this.tree;
    const inside = (p) => insideRing(p, t, reach);
    for (const d of this.dirtballs) {
      if (d.solid && inside(d)) d.knockBack(d.x - t.x, d.y - t.y, push);
    }
    for (const b of [...this.bacteria]) {
      if (!b.alive || !inside(b)) continue;
      const dx = b.x - t.x;
      const dy = b.y - t.y;
      if (b.addDirt(dirt)) this.turnIntoDirtball(b).knockBack(dx, dy, push);
      else b.knockBack(dx, dy, push, slowTime, slowFactor);
    }
  }

  /** Pushes every crawling bacteria inside the ring away from the sprout
   *  (a revived sprout, or a backup taking over, clears a little room). */
  repel(reach, push) {
    for (const b of this.bacteria) {
      if (!b.crawling || !insideRing(b, this.tree, reach)) continue;
      b.knockBack(b.x - this.tree.x, b.y - this.tree.y, push);
    }
  }

  updateFlow(dt) {
    if (this.phase === 'banner') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.phase = 'play';
    } else if (this.phase === 'play') {
      if (this.toSpawn > 0 && !this.frozen) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnOne();
          this.toSpawn -= 1;
          this.spawnTimer = this.spawnEvery;
        }
      }
      const empty = this.toSpawn === 0 && this.bacteria.length === 0 && this.dirtballs.length === 0;
      // A boss level: once its own bacteria are gone, the boss comes. The
      // level is cleared when the boss is back underground and the pot is empty.
      const bossToCome = this.bossLevel && !this.bossBeaten;
      if (bossToCome && empty && !this.boss && !this.bossPlan) {
        this.callBoss();
      } else if (!bossToCome && empty) {
        this.phase = 'clear';
        this.phaseT = LEVELS.clearDelay;
        this.emit('cleared', { level: this.level });
      }
    } else if (this.phase === 'clear') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startLevel(this.level + 1);
    }
    // Decide where the next bacteria appear a little early, so the glasses can show them.
    if (this.phase === 'banner' || this.phase === 'play') {
      while (this.upcoming.length < this.toSpawn && this.untilUpcoming(this.upcoming.length) <= LOOKAHEAD) {
        this.upcoming.push(this.planBacteria());
      }
    }
  }

  // ------------------------------------------------------ the sprout is lost

  gameOver() {
    this.over = true;
    this.resumeTo = this.phase;
    this.phase = 'over';
    this.emit('gameover', { score: this.score, level: this.level });
  }

  /** The backup sprout, if one was picked and it hasn't taken over yet. */
  get backupSprout() { return this.loadout.sprouts[this.sproutIndex + 1] ?? null; }

  /** Hearts a revive brings back: half the hearts the sprout could hold. */
  get reviveHearts() { return this.maxLives / 2; }

  /** A revive is on offer: the sprout is lost, there's no backup left to
   *  carry on with, and this game hasn't used one. */
  get canRevive() { return this.over && this.revivesLeft > 0 && !this.backupSprout; }

  /** Brings the lost sprout back with half its hearts (once a game). */
  revive() {
    if (!this.canRevive) return false;
    this.revivesLeft -= 1;
    this.lives = this.reviveHearts;
    this.carryOn('revive');
    return true;
  }

  /** The backup sprout takes over, fresh, and the game goes on. */
  useBackup() {
    if (!this.over || !this.backupSprout) return false;
    this.sproutIndex += 1;
    this.plant(this.loadout.sprouts[this.sproutIndex]);
    this.carryOn('backup');
    return true;
  }

  /** Back to the game, with a little room cleared round the sprout. */
  carryOn(type) {
    this.over = false;
    this.phase = this.resumeTo ?? 'play';
    this.resumeTo = null;
    this.treeHurt = 0;
    this.repel(REVIVE.reach, REVIVE.push);
    this.emit(type, { x: this.tree.x, y: this.tree.y, lives: this.lives, sprout: this.gear.sprout, reach: REVIVE.reach });
  }
}

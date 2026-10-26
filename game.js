// The rules of Klayman. No drawing, no sound, no DOM: the game only changes
// numbers and announces what happened through events, so it can be tested.
import {
  BACTERIA, COINS, DIRTBALL, ITEMS, KLAYMAN, LEVELS, LOOKAHEAD, REVIVE, SCORE, SHOT, TOOLS, TREE,
} from './config.js';
import {
  TREE_SPOT, dist, insideRing, insideSoil, keepOnSoil, randomSpotNear, randomSpotOnSoil, rimPoint,
} from './world.js';
import { Klayman } from './klayman.js';
import { Bacteria } from './bacteria.js';
import { Dirtball } from './dirtball.js';
import { DirtShot } from './dirtshot.js';
import { Coin, Item, pickItem } from './items.js';
import { gearFor } from './gear.js';

/** pressed/held: the phone's button (push or throw). throwPressed/throwHeld:
 *  the throw key. pushPressed: the push key. auto: auto throw (and push). */
export const NO_INPUT = Object.freeze({
  x: 0, y: 0, pressed: false, held: false, throwPressed: false, throwHeld: false, pushPressed: false, auto: false,
});

// Where the sunflower's head is, above the spot it's rooted in (unscaled).
const FLOWER_TOP = 54;

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

export class Game {
  /** `loadout` is { tools, sprouts }: what the player picked on the setup
   *  page. sprouts[1], if there is one, is the backup. */
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
    };
    this.sproutIndex = 0;
    this.plant(this.loadout.sprouts[0]);
    this.klay = new Klayman(TREE_SPOT.x, TREE_SPOT.y + 62);
    this.tree = { x: TREE_SPOT.x, y: TREE_SPOT.y };
    this.bacteria = [];
    this.dirtballs = [];
    this.shots = [];
    this.item = null;
    this.coins = [];
    this.lock = null;              // the dirt gun's target: the closest bacteria
    this.upcoming = [];            // where the next bacteria will appear, soonest first (the glasses show them)
    this.nextItem = null;          // ...and the next special item
    this.score = 0;
    this.earned = 0;               // coins (K) picked up this game
    this.boost = 0;
    this.freeze = 0;
    this.itemTimer = this.itemEvery;
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
    this.itemEvery = g.itemEvery ?? ITEMS.every;
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
  get frozen() { return this.freeze > 0; }
  get itemsUnlocked() { return this.level >= ITEMS.unlockLevel; }
  /** Level 7 skill: dirt thrown from a distance breaks a dirtball. */
  get skillUnlocked() { return this.level >= KLAYMAN.skillLevel; }
  /** How much bigger the sprout has grown (water drops, a mushroom growing). */
  get treeScale() { return 1 + TREE.growPerWater * (this.maxLives - this.gear.lives); }
  /** Bacteria can't get into the sprout: corn's leaves are closed, or a lily is. */
  get sproutClosed() { return this.shield > 0 || this.hidden > 0; }

  /** Bacteria still to beat this level: to come, crawling or dirty, or inside a dirtball. */
  get bacteriaLeft() {
    const alive = this.bacteria.filter((b) => b.alive).length;
    const balls = this.dirtballs.filter((d) => d.state !== 'breaking').length;
    return this.toSpawn + alive + balls;
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
    this.phase = 'banner';
    this.phaseT = LEVELS.bannerTime;
    const unlocksItems = n === ITEMS.unlockLevel;
    const unlocksSkill = n === KLAYMAN.skillLevel;
    if (unlocksItems) this.itemTimer = this.itemEvery;
    this.emit('level', { level: n, unlocksItems, unlocksSkill });
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

  get shotRange() { return SHOT.range * this.gear.range; }

  spawnShot(x, y, dir, target = null) {
    const shot = new DirtShot(x, y, dir, { range: this.shotRange, target });
    shot.gun = this.gear.lockOn;
    this.shots.push(shot);
    this.emit('throw', { x, y, gun: this.gear.lockOn });
  }

  /** The dirt gun's pick: the nearest bacteria a shot can reach. */
  lockTarget(from) {
    let best = null;
    let bestD = this.shotRange;
    for (const b of this.bacteria) {
      if (!b.alive) continue;
      const d = dist(b, from);
      if (d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  pushOutOfObstacles(p, r, sproutBlocks = true) {
    for (const b of this.dirtballs) {
      if (b.solid) separate(p, b, r + DIRTBALL.radius);
    }
    if (sproutBlocks) separate(p, this.tree, r + TREE.radius * 0.6);
  }

  // -------------------------------------------------------------- update

  update(dt, input = NO_INPUT) {
    if (this.over) return;
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt);
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    if (this.treeHurt > 0) this.treeHurt = Math.max(0, this.treeHurt - dt);

    this.lock = this.gear.lockOn ? this.lockTarget(this.klay) : null;
    this.klay.update(dt, input, this);
    this.updateShots(dt);
    this.updateBacteria(dt);
    if (this.over) return;
    this.updateDirtballs(dt);
    this.updateItems(dt);
    this.updateCoins(dt);
    this.updateSprout(dt);
    this.updateFlow(dt);
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.update(dt, this.bacteria);
      if (s.dead) continue;
      for (const b of this.bacteria) {
        if (!b.alive) continue;
        if (dist(b, s) < BACTERIA.radius + SHOT.radius) {
          s.dead = true;
          this.emit('hit', { x: b.x, y: b.y });
          if (b.addDirt(this.boostFactor)) this.turnIntoDirtball(b);
          break;
        }
      }
      if (s.dead || !this.skillUnlocked) continue;
      // Before level 7, dirt flies past dirtballs. After, it breaks them.
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
    this.addDirtball(b.x, b.y);
    this.emit('dirtball', { x: b.x, y: b.y });
  }

  updateBacteria(dt) {
    const frozen = this.frozen;
    const closed = this.sproutClosed;
    const coat = TOOLS.coat;
    // A closed lily can't be seen: bacteria wander instead of heading for it.
    const target = this.hidden > 0 ? null : this.tree;
    for (const b of this.bacteria) {
      b.update(dt, target, frozen, this.tree);
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
        // A closed sprout is a wall: they bump into it and wait.
        if (closed) separate(c, this.tree, TREE.radius + 8);
        keepOnSoil(c, 6);
      }
    }
    this.bacteria = this.bacteria.filter((b) => !b.dead);
  }

  hurtTree() {
    this.lives = Math.max(0, this.lives - 1);
    this.treeHurt = 0.5;
    this.emit('treeHurt', { lives: this.lives });
    if (this.lives <= 0) this.gameOver();
  }

  updateDirtballs(dt) {
    for (const d of this.dirtballs) {
      d.update(dt, this.frozen);

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
    this.dropCoin(spot, COINS.dropValue);
  }

  addScore(points, at) {
    this.score += points;
    this.emit('score', { points, x: at.x, y: at.y });
  }

  // ---------------------------------------------------------------- items

  /** Where the sunflower's head is right now (it grows with the sprout). */
  get flowerTop() {
    return { x: this.tree.x, y: this.tree.y - FLOWER_TOP * this.treeScale };
  }

  /** The next item: what it is, and where it lands (near the sprout, or
   *  close to a sunflower). Decided ahead, so the glasses can show it; what
   *  they show is what comes. */
  planItem() {
    const { min, max } = this.gear.drop ?? ITEMS.nearSprout;
    const spot = randomSpotNear(this.tree, min, max, this.rng, this.klay);
    const type = pickItem(this.lives, this.maxLives, this.rng, this.gear.maxLives);
    return { type, x: spot.x, y: spot.y };
  }

  updateItems(dt) {
    if (!this.itemsUnlocked) return;
    if (this.item) {
      this.item.update(dt);
      if (this.item.landed && dist(this.item, this.klay) < ITEMS.pickupRadius) {
        this.useItem(this.item);
        this.item = null;
      } else if (this.item.gone) {
        this.item = null;
      }
    }
    this.itemTimer -= dt;
    if (!this.item && !this.nextItem && this.itemTimer <= LOOKAHEAD) this.nextItem = this.planItem();
    if (this.itemTimer <= 0) {
      this.itemTimer += this.itemEvery;
      if (!this.item) {
        const { type, x, y } = this.nextItem ?? this.planItem();
        const from = this.gear.drop ? this.flowerTop : null;
        this.item = new Item(type, x, y, from);
        this.emit('itemAppears', { item: type, x, y, from });
      }
      this.nextItem = null;
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

  updateCoins(dt) {
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) {
      this.coinTimer += COINS.every;
      this.dropCoin(randomSpotOnSoil(this.rng), COINS.value);
    }
    for (const c of this.coins) {
      c.update(dt);
      if (!c.gone && dist(c, this.klay) < COINS.pickupRadius) {
        c.taken = true;
        this.earned += c.value;
        this.emit('coin', { value: c.value, x: c.x, y: c.y });
      }
    }
    this.coins = this.coins.filter((c) => !c.taken && !c.gone);
  }

  dropCoin(at, value) {
    this.coins.push(new Coin(at.x, at.y, value, COINS.lifetime));
    this.emit('coinAppears', { value, x: at.x, y: at.y });
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
        const { reach, push, slowTime, slowFactor } = g.spores;
        this.repel(reach, push, slowTime, slowFactor);
        this.emit('spores', { ...at, reach });
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

  /** Pushes every crawling bacteria inside the ring away from the sprout,
   *  and slows it down if `slowTime` is set. Dirty ones and dirtballs stay. */
  repel(reach, push, slowTime = 0, slowFactor = 1) {
    for (const b of this.bacteria) {
      if (!b.crawling || !insideRing(b, this.tree, reach)) continue;
      b.knockBack(b.x - this.tree.x, b.y - this.tree.y, push, slowTime, slowFactor);
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
      if (this.toSpawn === 0 && this.bacteria.length === 0 && this.dirtballs.length === 0) {
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
    this.itemTimer = Math.min(this.itemTimer, this.itemEvery);
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

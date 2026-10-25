// The rules of Klayman. No drawing, no sound, no DOM: the game only changes
// numbers and announces what happened through events, so it can be tested.
import { BACTERIA, COINS, DIRTBALL, ITEMS, KLAYMAN, LEVELS, SCORE, SHOT, SPROUTS, TREE } from './config.js';
import { TREE_SPOT, dist, insideSoil, keepOnSoil, randomSpotNear, randomSpotOnSoil, rimPoint } from './world.js';
import { Klayman } from './klayman.js';
import { Bacteria } from './bacteria.js';
import { Dirtball } from './dirtball.js';
import { DirtShot } from './dirtshot.js';
import { Coin, Item, pickItem } from './items.js';
import { gearFor } from './gear.js';

export const NO_INPUT = Object.freeze({ x: 0, y: 0, pressed: false, held: false, auto: false });

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
  /** `loadout` is { tool, sprout }: what the player picked on the setup page. */
  constructor({ rng = Math.random, loadout } = {}) {
    this.rng = rng;
    this.events = [];
    this.reset(loadout);
  }

  reset(loadout = this.gear) {
    this.gear = gearFor(loadout);
    const g = this.gear;
    this.klay = new Klayman(TREE_SPOT.x, TREE_SPOT.y + 62);
    this.tree = { x: TREE_SPOT.x, y: TREE_SPOT.y };
    this.bacteria = [];
    this.dirtballs = [];
    this.shots = [];
    this.item = null;
    this.coins = [];
    this.score = 0;
    this.earned = 0;               // coins (K) picked up this game
    this.lives = g.lives;
    this.maxLives = g.lives;
    this.treeHurt = 0;
    this.boost = 0;
    this.freeze = 0;
    this.itemEvery = g.itemEvery ?? ITEMS.every;
    this.itemTimer = this.itemEvery;
    this.coinTimer = COINS.every;
    this.healTimer = g.healEvery;
    this.pulseTimer = g.pulseEvery;
    this.growTimer = g.growEvery;
    this.over = false;
    this.events.length = 0;
    this.startLevel(1);
  }

  // ---------------------------------------------------------------- state

  get boostFactor() { return this.boost > 0 ? ITEMS.bagBoost : 1; }
  get frozen() { return this.freeze > 0; }
  get itemsUnlocked() { return this.level >= ITEMS.unlockLevel; }
  /** Level 7 skill: dirt thrown from a distance breaks a dirtball. */
  get skillUnlocked() { return this.level >= KLAYMAN.skillLevel; }
  /** How much bigger the sprout has grown (water drops, a mushroom growing). */
  get treeScale() { return 1 + TREE.growPerWater * (this.maxLives - this.gear.lives); }

  levelSize(n) { return LEVELS.firstCount + LEVELS.extraPerLevel * (n - 1); }

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
    this.spawnEvery = Math.max(LEVELS.minSpawnEvery, LEVELS.spawnEvery - LEVELS.spawnEveryStep * (n - 1));
    this.spawnTimer = 0.4;
    this.phase = 'banner';
    this.phaseT = LEVELS.bannerTime;
    const unlocksItems = n === ITEMS.unlockLevel;
    const unlocksSkill = n === KLAYMAN.skillLevel;
    if (unlocksItems) this.itemTimer = this.itemEvery;
    this.emit('level', { level: n, unlocksItems, unlocksSkill });
  }

  spawnOne() {
    let p = rimPoint(this.rng() * Math.PI * 2, 12);
    for (let i = 0; i < 12 && dist(p, this.klay) < 90; i++) {
      p = rimPoint(this.rng() * Math.PI * 2, 12);
    }
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

  dirtballInFront(k, dir) {
    const cx = k.x + dir.x * KLAYMAN.reach;
    const cy = k.y + dir.y * KLAYMAN.reach;
    const half = 18 + DIRTBALL.radius * 0.5;
    let best = null;
    let bestD = Infinity;
    for (const b of this.dirtballs) {
      if (!b.solid) continue;
      if (Math.abs(b.x - cx) < half && Math.abs(b.y - cy) < half) {
        const d = dist(b, k);
        if (d < bestD) { best = b; bestD = d; }
      }
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
    for (const b of this.bacteria) {
      b.update(dt, this.tree, frozen);
      if (!b.crawling || frozen) continue;

      if (dist(b, this.tree) < TREE.radius + 4) {
        b.absorbInto(this.tree);
        this.hurtTree();
        if (this.over) return;
        continue;
      }
      // A healthy Klayman swallows the bacteria and turns green.
      // While he's green, or in his lab coat, bacteria crawl straight past him.
      if (!this.gear.immune && !this.klay.poisoned
        && dist(b, this.klay) < BACTERIA.radius + KLAYMAN.radius - 4) {
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
        keepOnSoil(c, 6);
      }
    }
    this.bacteria = this.bacteria.filter((b) => !b.dead);
  }

  hurtTree() {
    this.lives -= 1;
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
    this.dropCoin(spot, COINS.dropValue, COINS.dropLifetime);
  }

  addScore(points, at) {
    this.score += points;
    this.emit('score', { points, x: at.x, y: at.y });
  }

  updateItems(dt) {
    if (!this.itemsUnlocked) return;
    if (this.item) {
      this.item.update(dt);
      if (dist(this.item, this.klay) < ITEMS.pickupRadius) {
        this.useItem(this.item);
        this.item = null;
      } else if (this.item.gone) {
        this.item = null;
      }
    }
    this.itemTimer -= dt;
    if (this.itemTimer <= 0) {
      this.itemTimer += this.itemEvery;
      if (!this.item) {
        const { min, max } = ITEMS.nearSprout;
        const spot = randomSpotNear(this.tree, min, max, this.rng, this.klay);
        const type = pickItem(this.lives, this.maxLives, this.rng, this.gear.maxLives);
        this.item = new Item(type, spot.x, spot.y);
        this.emit('itemAppears', { type, x: spot.x, y: spot.y });
      }
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
      this.dropCoin(randomSpotOnSoil(this.rng), COINS.value, COINS.lifetime);
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

  dropCoin(at, value, lifetime) {
    this.coins.push(new Coin(at.x, at.y, value, lifetime));
    this.emit('coinAppears', { value, x: at.x, y: at.y });
  }

  // --------------------------------------------------------- sprout powers

  updateSprout(dt) {
    const g = this.gear;
    if (g.healEvery) {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer += g.healEvery;
        if (this.lives < this.maxLives) {
          this.lives += 1;
          this.emit('heal', { x: this.tree.x, y: this.tree.y });
        }
      }
    }
    if (g.pulseEvery) {
      this.pulseTimer -= dt;
      if (this.pulseTimer <= 0) {
        this.pulseTimer += g.pulseEvery;
        this.releaseSpores();
      }
    }
    if (g.growEvery) {
      this.growTimer -= dt;
      if (this.growTimer <= 0) {
        this.growTimer += g.growEvery;
        if (this.maxLives < g.maxLives) {
          this.maxLives += 1;
          this.lives += 1;
          this.emit('grow', { x: this.tree.x, y: this.tree.y });
        }
      }
    }
  }

  /** Mushroom: pushes every crawling bacteria away and slows it down.
   *  Dirty ones and dirtballs stay where they are. */
  releaseSpores() {
    const m = SPROUTS.mushroom;
    for (const b of this.bacteria) {
      if (b.crawling) b.knockBack(b.x - this.tree.x, b.y - this.tree.y, m.push, m.slowTime, m.slowFactor);
    }
    this.emit('spores', { x: this.tree.x, y: this.tree.y });
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
  }

  gameOver() {
    this.over = true;
    this.phase = 'over';
    this.emit('gameover', { score: this.score, level: this.level });
  }
}

// The rules of Klayman. No drawing, no sound, no DOM: the game only changes
// numbers and announces what happened through events, so it can be tested.
import {
  BACTERIA, BOSS, COINS, DIRTBALL, GADGETS, ITEMS, KINDS, KLAYMAN, LEVELS, LOOKAHEAD, REVIVE, SCORE, SEASONS, SHOT, SPROUTS, TIMER, TOOLS, TREE,
} from './config.js';
import {
  RING_SQUASH, SOIL, TREE_SPOT, dist, insideRing, insideSoil, keepOnSoil, randomSpotNear, randomSpotOnSoil, rimPoint,
} from './world.js';
import { Klayman } from './klayman.js';
import { makeBacteria } from './bacteria.js';
import { Germ } from './germ.js';
import { DirtWave } from './dirtwave.js';
import { Dirtball } from './dirtball.js';
import { DirtShot } from './dirtshot.js';
import { Boss, bossHp, bossRed, bossSpawnEvery, isBossLevel } from './boss.js';
import { Gadget } from './gadgets.js';
import { Coin, Item, pickItem } from './items.js';
import { gearFor, weatherOf } from './gear.js';

/** x, y: which way to walk. pressed/held: the action button (the K button on
 *  a phone, Space or a click on a computer): it pushes a dirtball Klayman is
 *  touching, and throws otherwise. auto: auto throw (and push). aim: a point
 *  in the pot to aim at (the mouse, on a computer), or null. steer: a way to
 *  aim, any length (the K button dragged, on a phone), or null. seek: aim at
 *  the closest bacteria (the K button pressed without dragging). With none
 *  of the three, he aims the way he walks. gadget: which gadget to use this
 *  step (0 or 1), or -1. */
export const NO_INPUT = Object.freeze({
  x: 0, y: 0, pressed: false, held: false, auto: false, aim: null, steer: null, seek: false, gadget: -1,
});

// Nothing raising or lowering anything.
const PLAIN = Object.freeze({});

// Where a flower's head is, above the spot it's rooted in (unscaled).
const FLOWER_TOP = { sunflower: 54, daisy: 50 };

// A boss rises at one of the pot's four corners, BOSS.corner in from the rim
// (and in timer mode, bacteria come out of them).
const BOSS_CORNERS = [-3, -1, 1, 3].map((k) => (k * Math.PI) / 4);

/** The kinds `count` bacteria come in: each kind's share of them (rounded),
 *  the rest green, shuffled with `rng`. `shares` is { kind: share }. */
export function dealKinds(count, shares, rng) {
  const deck = [];
  for (const [kind, share] of Object.entries(shares)) {
    for (let i = Math.round(count * share); i > 0 && deck.length < count; i--) deck.push(kind);
  }
  while (deck.length < count) deck.push('green');
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Each kind's share where `open(kind's rules)` says it comes. */
const sharesWhere = (open) => Object.fromEntries(
  Object.entries(KINDS).filter(([, k]) => open(k)).map(([kind, k]) => [kind, k.share]),
);

// A deck is dealt this many at a time where there's no end to the bacteria (a timer run, a boss).
const DECK = 20;

// Timer mode sends bacteria out as fast as a level-5 boss does.
const TIMER_SPAWN = bossSpawnEvery(BOSS.firstLevel);

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
  /** `loadout` is { tools, sprouts, gadgets, seasons }: what the player
   *  picked on the setup page. sprouts[1], if there is one, is the backup;
   *  seasons holds none, one, or two to mix (the 2nd season slot). */
  constructor({ rng = Math.random, loadout } = {}) {
    this.rng = rng;
    this.events = [];
    this.reset(loadout);
  }

  /** A new game. Survival starts at `level` (a level skip, or admin mode);
   *  with `run` ('t1', 't3' or 't5'), it's a timer-mode run instead. */
  reset(loadout = this.loadout, level = 1, run = null) {
    this.loadout = {
      tools: [...(loadout?.tools ?? [])],
      sprouts: loadout?.sprouts?.length ? [...loadout.sprouts] : ['sprout'],
      gadgets: [...new Set(loadout?.gadgets ?? [])].filter((id) => GADGETS[id]),
      seasons: [...new Set(loadout?.seasons ?? [])].filter((id) => SEASONS[id]),
    };
    this.seasons = this.loadout.seasons;
    this.level = level;            // set early: the seasons and the sprout's powers depend on it
    this.stormTimer = this.weather.storm?.every;
    this.stormTargets = [];        // rainy: what the next lightning will strike, once picked
    this.items = [];               // special items out on the soil (or flying)
    this.potItems = itemSource('pot', ITEMS.every);
    this.sproutIndex = 0;
    this.plant(this.loadout.sprouts[0]);
    this.klay = new Klayman(TREE_SPOT.x, TREE_SPOT.y + 62);
    this.tree = { x: TREE_SPOT.x, y: TREE_SPOT.y };
    this.bacteria = [];
    this.dirtballs = [];
    this.shots = [];
    this.germs = [];               // orange bacteria's germs, flying at Klayman
    this.waves = [];               // the bazoo-klay's waves of dirt
    this.coins = [];
    this.gadgets = this.loadout.gadgets.map((id) => new Gadget(id));
    this.lock = null;              // the dirt gun's target: the closest thing it can hit
    this.upcoming = [];            // where the next bacteria will appear, soonest first (the glasses show them)
    this.nextCoin = null;          // ...and the next 1K coin
    this.score = 0;
    this.earned = 0;               // coins (K) picked up this game
    this.medicine = 0;             // seconds medicine's power-up has left
    this.freeze = 0;
    this.coinTimer = COINS.every;
    this.over = false;
    this.resumeTo = null;
    this.revivesLeft = REVIVE.perGame;
    this.run = null;               // timer mode: { id, secs, left, surges, won }
    this.held = false;             // admin's sandbox: no new bacteria while held
    this.events.length = 0;
    if (TIMER.runs[run]) this.startRun(run);
    else this.startLevel(level);
  }

  /** Puts a sprout in the pot: its hearts and its powers' clocks (spring
   *  brings them round sooner), and summer's sun on it. */
  plant(sprout) {
    this.gear = gearFor({ tools: this.loadout.tools, sprout, seasons: this.seasons, level: this.level });
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
    this.sunTimer = this.weather.sun?.every;
    this.sunGrown = 0;             // summer: hearts the sun has grown this sprout
  }

  // ---------------------------------------------------------------- state

  /** What this game's seasons do at this level (nothing, with none; both,
   *  mixed): every level they get 1% better (seasonAt in gear.js). */
  get weather() {
    const key = `${this.seasons}@${this.level}`;
    if (this.weatherKey !== key) {
      this.weatherKey = key;
      this.weatherNow = weatherOf(this.seasons, this.level);
    }
    return this.weatherNow;
  }

  /** This game is played in season `id` (alone, or mixed with another). */
  inSeason(id) { return this.seasons.includes(id); }

  /** The sprout's powers at this level: spring brings them round a little
   *  sooner every level. A power already counting down keeps its count; the
   *  next one waits the new, shorter time. */
  regear() {
    this.gear = gearFor({ tools: this.loadout.tools, sprout: this.gear.sprout, seasons: this.seasons, level: this.level });
    if (this.flowerItems) this.flowerItems.every = this.gear.itemEvery;
    if (this.flowerCoins) this.flowerCoins.every = this.gear.coinEvery;
  }

  /** The most hearts the sprout can hold: its own limit, and what summer's sun grew on top. */
  get heartCap() { return this.gear.maxLives + this.sunGrown; }

  /** Medicine's power-up while it lasts. */
  get medicineEffect() { return this.medicine > 0 ? ITEMS.medicine : PLAIN; }

  /** The booster: 'boost' for its first 5 seconds, 'crash' for the 2 after, else null. */
  get booster() {
    const g = this.gadgets.find((x) => x.id === 'booster' && x.active);
    if (!g) return null;
    return g.t < g.spec.boost.time ? 'boost' : 'crash';
  }
  /** What the booster does right now (nothing, when it isn't working). */
  get boosterEffect() { return GADGETS.booster[this.booster] ?? PLAIN; }

  /** Everything that changes Klayman's `key` right now, multiplied: his
   *  tools, medicine and the booster. Keys: fireRate, speed, range, dirt. */
  power(key) {
    return (this.gear[key] ?? 1) * (this.medicineEffect[key] ?? 1) * (this.boosterEffect[key] ?? 1);
  }
  /** How much quicker than plain he throws. */
  get fireRate() { return this.power('fireRate'); }
  /** How much faster than plain he walks. */
  get walkSpeed() { return this.power('speed'); }
  /** How much dirt a throw puts on (1 is a plain throw). */
  get dirtPower() { return this.power('dirt'); }
  get frozen() { return this.freeze > 0; }
  get itemsUnlocked() { return this.timed || this.level >= ITEMS.unlockLevel; }
  /** Level 7 skill: dirt thrown from a distance breaks a dirtball. */
  /** How much bigger the sprout has grown (water drops, a mushroom growing). */
  get treeScale() { return 1 + TREE.growPerWater * (this.maxLives - this.gear.lives); }
  /** Bacteria can't get into the sprout: corn's leaves are closed, or a lily is. */
  get sproutClosed() { return this.shield > 0 || this.hidden > 0; }
  /** This level ends with a boss bacteria. */
  get bossLevel() { return isBossLevel(this.level); }
  /** A boss is out, or rumbling up. */
  get bossTime() { return Boolean(this.boss || this.bossPlan); }
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
    if (g.growEvery && this.maxLives + 1 <= this.heartCap) out.push({ power: 'grow', secs: this.growTimer });
    const sun = this.weather.sun;
    if (sun && this.sunGrown < sun.max) out.push({ power: 'sun', secs: this.sunTimer });
    return out;
  }

  /** Bacteria still to beat this level: to come, crawling or dirty, inside
   *  a dirtball, and the boss until it's worn out. */
  get bacteriaLeft() {
    const alive = this.bacteria.filter((b) => b.alive).length;
    const balls = this.dirtballs.filter((d) => d.state !== 'breaking').length;
    const boss = this.bossLevel && !this.bossBeaten && !(this.boss && !this.boss.alive) ? 1 : 0;
    const toCome = this.timed ? 0 : this.toSpawn;   // timer mode: no end to them, so what's in the pot
    return toCome + alive + balls + boss;
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

  /** The fertilizer is working. */
  get fertilized() { return this.gadgets.some((g) => g.id === 'fertilizer' && g.active); }

  /** Every bacteria's speed, now: slower while the fertilizer works, and in
   *  winter; faster as a timer run goes on. */
  get pace() {
    return (this.fertilized ? GADGETS.fertilizer.slowFactor : 1) * (this.weather.bacteriaPace ?? 1) * this.surge;
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
    this.regear();
    this.toSpawn = this.levelSize(n);
    this.kindDeck = dealKinds(this.toSpawn, this.kindShares(), this.rng);
    this.bossDeck = [];
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
    if (unlocksItems) this.potItems.timer = ITEMS.every;
    this.emit('level', { level: n, unlocksItems, boss: isBossLevel(n), firstBoss: n === BOSS.firstLevel });
  }

  /** A spot on the rim, not right next to Klayman (timer mode: at a corner). */
  planBacteria() {
    if (this.timed) return this.planCorner();
    let p = rimPoint(this.rng() * Math.PI * 2, 12);
    for (let i = 0; i < 12 && dist(p, this.klay) < 90; i++) {
      p = rimPoint(this.rng() * Math.PI * 2, 12);
    }
    return p;
  }

  spawnOne() {
    const p = this.upcoming.shift() ?? this.planBacteria();
    const b = this.addBacteria(p.x, p.y, this.nextKind());
    this.emit('spawn', { x: b.x, y: b.y, kind: b.kind });
  }

  // ------------------------------------------------- kinds (v27)

  /** The share of each kind among this game's own bacteria: from level 10
   *  blue, from 20 orange; in a timer run, the kinds that come in it. */
  kindShares() {
    return this.timed
      ? sharesWhere((k) => k.runs.includes(this.run.id))
      : sharesWhere((k) => this.level >= k.from);
  }

  /** ...and among what a boss sends out: orange from level 25, blue from 35. */
  bossShares() { return sharesWhere((k) => this.level >= k.bossFrom); }

  /** The kind of the next bacteria to come: a level's are dealt when it
   *  starts; with no end to them, they're dealt DECK at a time. */
  nextKind() {
    if (!this.kindDeck.length && this.timed) this.kindDeck = dealKinds(DECK, this.kindShares(), this.rng);
    return this.kindDeck.pop() ?? 'green';
  }

  nextBossKind() {
    if (!this.bossDeck.length) this.bossDeck = dealKinds(DECK, this.bossShares(), this.rng);
    return this.bossDeck.pop();
  }

  addBacteria(x, y, kind = 'green') {
    const b = makeBacteria(kind, x, y, this.bacteriaSpeed(this.level));
    b.decayTime *= this.weather.decay ?? 1;          // autumn: dirt wears off slower
    this.bacteria.push(b);
    return b;
  }

  /** The dirt a blue bacteria looks for: the nearest bacteria in dirt, or
   *  dirtball, to `from`. Null when there's none. */
  dirtNear(from) {
    let best = null;
    let bestD = Infinity;
    const consider = (t) => {
      const d = dist(t, from);
      if (d < bestD) { best = t; bestD = d; }
    };
    for (const b of this.bacteria) if (b.state === 'dirty' && b !== from) consider(b);
    for (const d of this.dirtballs) if (d.solid) consider(d);
    return best;
  }

  /** Orange ones charge up a germ once Klayman's in reach, and spit it. */
  spit(b, dt) {
    const { reach, every, charge } = KINDS.orange;
    if (b.charging > 0) {
      b.charging -= dt;
      if (b.charging <= 0) {
        b.charging = 0;
        b.cooldown = every - charge;
        this.fireGerm(b);
      }
      return;
    }
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.cooldown <= 0 && dist(b, this.klay) <= reach) {
      b.charging = charge;
      this.emit('charge', { x: b.x, y: b.y });
    }
  }

  /** A germ flies from the orange bacteria's eye at where Klayman stands now. */
  fireGerm(b) {
    const k = this.klay;
    this.germs.push(new Germ(b.x, b.y, { x: k.x - b.x, y: k.y - b.y }));
    this.emit('spit', { x: b.x, y: b.y });
  }

  /** Blue ones jump to stamp the dirt off whatever's dirty in reach, every
   *  so often: up, and when they land, the stamp; then one small bounce. */
  stomp(b, dt) {
    const { reach, every, jump, land } = KINDS.blue;
    b.cooldown = Math.max(0, b.cooldown - dt);       // counts from one jump to the next
    if (b.jumping) {
      const before = b.jump;
      b.jump += dt;
      if (before < land && b.jump >= land) this.stampDown(b);
      if (b.jump >= jump) b.jump = 0;
      return;
    }
    if (b.cooldown > 0 || !this.dirtAround(b, reach).length) return;
    b.cooldown = every;
    b.jump = 1e-6;
    this.emit('jump', { x: b.x, y: b.y });
  }

  /** Dirty bacteria and dirtballs within `reach` of `b`. */
  dirtAround(b, reach) {
    return [
      ...this.bacteria.filter((o) => o !== b && o.state === 'dirty' && dist(o, b) <= reach),
      ...this.dirtballs.filter((d) => d.solid && dist(d, b) <= reach),
    ];
  }

  /** A blue one lands: a layer of dirt off every dirty bacteria in reach,
   *  and a layer's worth off every dirtball's hold. Steam rises off each. */
  stampDown(b) {
    const { reach, dirt, hold } = KINDS.blue;
    const hit = this.dirtAround(b, reach);
    for (const t of hit) {
      if (t instanceof Dirtball) t.wear(hold);
      else t.shed(dirt);
    }
    const steam = hit.map((t) => ({ x: t.x, y: t.y, ball: t instanceof Dirtball }));
    this.emit('stomp', { x: b.x, y: b.y, steam });
  }

  /** The germs fly; one that reaches Klayman poisons him, orange (the lab
   *  coat keeps it out, and so does the whirlwind's wind). */
  updateGerms(dt) {
    if (this.frozen) return;
    const k = this.klay;
    const wind = this.windReach;
    for (const g of this.germs) {
      g.update(dt);
      if (g.dead) continue;
      if (wind > 0 && insideRing(g, k, wind)) {
        g.dead = true;
        this.emit('germBlown', { x: g.x, y: g.y });
      } else if (dist(g, k) <= KLAYMAN.radius + KINDS.orange.germ.radius) {
        g.dead = true;
        if (this.gear.immune) this.emit('germBlocked', { x: g.x, y: g.y });
        else if (k.poison('orange')) this.emit('poison', { x: k.x, y: k.y, kind: 'orange' });
        else this.emit('germBlocked', { x: g.x, y: g.y });
      }
    }
    this.germs = this.germs.filter((g) => !g.dead);
  }

  addDirtball(x, y, kind = 'green') {
    const d = new Dirtball(x, y, kind);
    d.hold *= this.weather.crackHold ?? 1;           // autumn: it takes far longer to crack open
    this.dirtballs.push(d);
    return d;
  }

  // ------------------------------------------------------- timer mode (v26)

  /** A timer-mode run: level 1's rules (special items from the start), no
   *  levels and no boss. Bacteria keep coming out of the pot's corners until
   *  the clock runs out; the clock starts once the banner is gone. */
  startRun(id) {
    const { secs } = TIMER.runs[id];
    this.level = 1;
    this.regear();
    this.run = { id, secs, left: secs, surges: 0, won: false };
    this.toSpawn = Infinity;
    this.kindDeck = [];
    this.bossDeck = [];
    this.spawnEvery = TIMER_SPAWN;
    this.spawnTimer = 0.4;
    this.upcoming = [];
    this.boss = null;
    this.bossPlan = null;
    this.bossWarn = 0;
    this.bossBeaten = false;
    this.phase = 'banner';
    this.phaseT = LEVELS.bannerTime;
    this.potItems.timer = ITEMS.every;
    this.emit('runStarts', { run: id, secs });
  }

  /** This game is a timer-mode run. */
  get timed() { return Boolean(this.run); }

  /** The run was won: the sprout was still there when time ran out. */
  get won() { return Boolean(this.run?.won); }

  /** How much more often bacteria come, and how much faster they crawl, than
   *  at the start of the run: 1, then 1.25, 1.5... every 20 seconds (added,
   *  not compounded). Survival: always 1. */
  get surge() { return this.timed ? 1 + TIMER.surge * this.run.surges : 1; }

  /** Timer mode: one of the pot's four corners, give or take a little, and not the one Klayman stands in. */
  planCorner() {
    const spots = BOSS_CORNERS.map((a) => rimPoint(a + (this.rng() * 2 - 1) * TIMER.spread, TIMER.corner));
    const clear = spots.filter((p) => dist(p, this.klay) >= 90);
    const pool = clear.length ? clear : spots;
    return pool[Math.floor(this.rng() * pool.length) % pool.length];
  }

  /** The clock, the surges, and the bacteria it keeps sending. A sandclock
   *  holds the bacteria back, never the clock. */
  updateRun(dt) {
    const run = this.run;
    run.left = Math.max(0, run.left - dt);
    if (run.left <= 0) {
      this.timeUp();
      return;
    }
    const surges = Math.floor((run.secs - run.left) / TIMER.surgeEvery);
    if (surges > run.surges) {
      run.surges = surges;
      this.spawnEvery = TIMER_SPAWN / this.surge;    // the next one waits the new, shorter time
      this.emit('surge', { surge: this.surge });
    }
    if (this.frozen || this.held) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnOne();
      this.spawnTimer = this.spawnEvery;
    }
  }

  /** Time's up with the sprout still there: the run is won. Every bacteria
   *  left pops, and a moment later (TIMER.lap) the game ends. */
  timeUp() {
    this.run.won = true;
    this.phase = 'won';
    this.phaseT = TIMER.lap;
    this.upcoming = [];
    for (const b of this.bacteria) {
      if (!b.alive) continue;
      b.breakApart();
      this.emit('pop', { x: b.x, y: b.y });
    }
    this.emit('timeUp', { run: this.run.id });
  }

  // ------------------------------------------- admin's sandbox (v27)
  // Everything here changes the game in play, at once: admin mode's pause
  // screen calls it (sandbox.js). The rules stay the game's own.

  /** Wears any tools, as many as are given. */
  wear(tools) {
    this.loadout.tools = [...new Set(tools)].filter((id) => TOOLS[id]);
    this.regear();
  }

  /** Takes these gadgets (two at most: there are two buttons), fresh. */
  carry(gadgets) {
    this.loadout.gadgets = [...new Set(gadgets)].filter((id) => GADGETS[id]).slice(0, 2);
    this.gadgets = this.loadout.gadgets.map((id) => new Gadget(id));
  }

  /** Plays in these seasons, as many as are given, mixed. */
  playIn(seasons) {
    this.loadout.seasons = [...new Set(seasons)].filter((id) => SEASONS[id]);
    this.seasons = this.loadout.seasons;
    this.regear();
    const storm = this.weather.storm;
    if (!storm) this.stormTargets = [];
    else if (!(this.stormTimer > 0)) this.stormTimer = storm.every;
    const sun = this.weather.sun;
    if (sun && !(this.sunTimer > 0)) this.sunTimer = sun.every;
  }

  /** Plants another sprout in the pot, fresh. */
  replant(sprout) {
    if (!SPROUTS[sprout]) return;
    this.loadout.sprouts[this.sproutIndex] = sprout;
    this.plant(sprout);
  }

  /** The sprout's hearts, and how many it can hold (at least half a heart). */
  setHearts(lives, maxLives = this.maxLives) {
    this.maxLives = Math.max(0.5, Math.min(20, maxLives));
    this.lives = Math.max(0.5, Math.min(this.maxLives, lives));
  }

  /** One bacteria of `kind`, where the next would come from. */
  spawnKind(kind) {
    const p = this.planBacteria();
    const b = this.addBacteria(p.x, p.y, kind);
    this.emit('spawn', { x: b.x, y: b.y, kind });
    return b;
  }

  /** An item of `type` on the soil near Klayman. */
  dropItem(type) {
    const spot = randomSpotNear(this.klay, 60, 110, this.rng);
    const item = new Item(type, spot.x, spot.y);
    this.items.push(item);
    this.emit('itemAppears', { item: type, x: spot.x, y: spot.y, from: null });
  }

  /** A coin worth `value` (K) near Klayman. */
  dropCoinNear(value) {
    this.dropCoin(randomSpotNear(this.klay, 50, 100, this.rng), value);
  }

  /** Every bacteria, dirtball and germ gone from the pot. */
  clearPot() {
    this.bacteria = [];
    this.dirtballs = [];
    this.germs = [];
    this.waves = [];
    this.upcoming = [];
    this.stormTargets = [];
  }

  /** Survival: straight on to level `n` (what's in the pot stays). */
  jumpTo(n) {
    if (this.timed) return;
    this.startLevel(Math.max(1, Math.round(n)));
  }

  /** A timer run: the clock set to `secs` left. */
  setClock(secs) {
    if (!this.timed || this.won) return;
    this.run.left = Math.max(0.5, Math.min(this.run.secs, secs));
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
    this.boss = new Boss(x, y, { hp: bossHp(this.level), spawnEvery: bossSpawnEvery(this.level), red: bossRed(this.level) });
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
    this.addBacteria(p.x, p.y, this.nextBossKind());
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
    if (boss.update(dt, this.frozen) && !this.held) this.bossSpawn();
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

  get shotRange() { return SHOT.range * this.power('range'); }

  spawnShot(x, y, dir, target = null) {
    if (this.gear.bazoo) {
      this.waves.push(new DirtWave(x, y, dir, { range: this.shotRange }));
      this.emit('blast', { x, y, dir });
      return;
    }
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
    return best;
  }

  /** The K button pressed without dragging: the closest bacteria (or the
   *  boss, measured to its edge), however far. Null when there's none. */
  nearestBacteria(from) {
    let best = null;
    let bestD = Infinity;
    for (const b of this.bacteria) {
      const d = dist(b, from);
      if (b.lockable && d < bestD) { best = b; bestD = d; }
    }
    if (this.boss?.lockable && this.boss.gap(from) < bestD) best = this.boss;
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
    if (this.medicine > 0) this.medicine = Math.max(0, this.medicine - dt);
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    if (this.treeHurt > 0) this.treeHurt = Math.max(0, this.treeHurt - dt);

    this.updateGadgets(dt, input.gadget ?? -1);
    this.lock = this.gear.lockOn ? this.lockTarget(this.klay) : null;
    this.klay.update(dt, input, this);
    this.updateShots(dt);
    this.updateWaves(dt);
    this.updateBacteria(dt);
    if (this.over) return;
    this.updateGerms(dt);
    this.updateDirtballs(dt);
    this.updateBoss(dt);
    this.updateItems(dt);
    this.updateCoins(dt);
    this.updateSprout(dt);
    this.updateWeather(dt);
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
      }
      // Dirt flies past dirtballs: they're only ever pushed (v27).
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  /** The bazoo-klay's waves sweep out; everything the front passes over is
   *  hit once: a third of a dirtball's dirt (more with medicine or the
   *  booster), and a knock back if it was clean. Dirtballs it passes over. */
  updateWaves(dt) {
    const { hits, knock } = TOOLS.bazoo;
    const dirt = (BACTERIA.maxDirt / hits) * (1 + 1e-9) * this.dirtPower;
    const boss = this.boss;
    for (const w of this.waves) {
      w.update(dt);
      for (const b of this.bacteria) {
        if (!b.alive || w.hit.has(b) || !w.reaches(b, BACTERIA.radius)) continue;
        w.hit.add(b);
        const clean = b.crawling;
        this.emit('hit', { x: b.x, y: b.y });
        if (b.addDirt(dirt)) this.turnIntoDirtball(b);
        else if (clean) b.knockBack(b.x - w.x, b.y - w.y, knock);
      }
      if (boss?.alive && !w.hit.has(boss) && w.reaches(boss.aimPoint, BOSS.foot.rx * 0.6)) {
        w.hit.add(boss);
        this.hitBoss(BOSS.shotDamage * this.dirtPower, boss.aimPoint);
      }
    }
    this.waves = this.waves.filter((w) => !w.dead);
  }

  turnIntoDirtball(b) {
    b.state = 'gone';
    b.dead = true;
    const ball = this.addDirtball(b.x, b.y, b.kind);
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
      // Green ones head for the sprout; orange ones for Klayman; blue ones for dirt.
      const goal = b.kind === 'orange' ? this.klay : b.kind === 'blue' ? this.dirtNear(b) : target;
      b.update(dt, goal, frozen, this.tree, pace);
      // The whirlwind's wind: nothing gets through to Klayman.
      if (wind > 0 && b.alive) this.blowAway(b, wind);
      if (!b.crawling || frozen) continue;
      if (b.kind === 'orange') this.spit(b, dt);
      else if (b.kind === 'blue') this.stomp(b, dt);
      if (!b.invades) {
        // The lab coat still slows them at a touch.
        if (this.gear.immune && dist(b, this.klay) < BACTERIA.radius + KLAYMAN.radius - 4
          && b.slowDown(coat.slowTime, coat.slowFactor)) this.emit('slowed', { x: b.x, y: b.y });
        continue;
      }

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
    if (this.won) return;          // time's up: nothing gets at it now
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
        this.addBacteria(d.x, d.y, d.kind).setDirtStage(BACTERIA.maxDirt - 1);
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
    const type = pickItem(this.lives, this.maxLives, this.rng, this.heartCap);
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
      case 'medicine':
        this.medicine = ITEMS.medicine.time;
        break;
      case 'water':
        this.maxLives = Math.min(this.heartCap, this.maxLives + 1);
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
    if (g.id === 'leaf') this.whirl(g.spec);
    this.emit('gadget', { id: g.id, index: i, x: at.x, y: at.y });
    return true;
  }

  /** The whirlwind's first gust: every bacteria inside its reach is flung
   *  `fling` further out, through the air, and every dirtball in it starts
   *  rolling away from Klayman. Then its wind holds the ring (blowAway). */
  whirl({ reach, fling }) {
    const k = this.klay;
    for (const b of this.bacteria) {
      if (b.alive && insideRing(b, k, reach)) b.fling(b.x - k.x, b.y - k.y, fling);
    }
    for (const d of this.dirtballs) {
      if (d.solid && insideRing(d, k, reach)) d.push({ x: d.x - k.x, y: d.y - k.y });
    }
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
      // The booster wears off: he goes grey.
      const peak = g.spec.boost?.time;
      if (running && g.id === 'booster' && before < peak && g.t >= peak) this.emit('boosterCrash', { x: this.klay.x, y: this.klay.y });
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
        if (this.maxLives + 1 <= this.heartCap) {
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

  // --------------------------------------------------------------- seasons

  /** Summer's sun and the rainy season's lightning, on their clocks. */
  updateWeather(dt) {
    const { sun, storm } = this.weather;
    if (sun && this.sunGrown < sun.max) {
      this.sunTimer -= dt;
      if (this.sunTimer <= 0) {
        this.sunTimer += sun.every;
        this.sunshine(sun);
      }
    }
    if (storm) {
      this.stormTimer -= dt;
      // A moment before it strikes, the lightning picks what it will hit
      // (the glasses mark it), and keeps that pick up to date.
      if (this.stormTimer <= storm.warn) this.aimStorm(storm.strikes);
      if (this.stormTimer <= 0) {
        this.stormTimer += storm.every;
        for (const target of this.stormTargets) this.lightning(target);
        this.stormTargets = [];
      }
    }
  }

  /** What lightning can strike: bacteria and dirtballs, never the boss. */
  get strikables() {
    return [...this.bacteria.filter((b) => b.alive), ...this.dirtballs.filter((d) => d.solid)];
  }

  /** `t` can still be struck: still out there, and still what it was. */
  strikable(t) {
    return t instanceof Dirtball ? t.solid && this.dirtballs.includes(t) : Boolean(t?.alive) && this.bacteria.includes(t);
  }

  /** Rainy: picks the `n` things nearest Klayman for the next strike. One
   *  that's gone meanwhile (beaten, or set rolling) gives way to the next
   *  nearest, so what the glasses mark is what gets struck. */
  aimStorm(n) {
    const k = this.klay;
    this.stormTargets = this.stormTargets.filter((t) => this.strikable(t));
    const pool = this.strikables.filter((t) => !this.stormTargets.includes(t));
    pool.sort((a, b) => dist(a, k) - dist(b, k));
    while (this.stormTargets.length < n && pool.length) this.stormTargets.push(pool.shift());
  }

  /** Summer: the sun spotlights the sprout and it grows half a heart (up to 2 more in all). */
  sunshine({ grow, max }) {
    const add = Math.min(grow, max - this.sunGrown);
    this.sunGrown += add;
    this.maxLives += add;
    this.lives += add;
    this.emit('sunshine', { x: this.tree.x, y: this.tree.y, amount: add });
  }

  /** Rainy: lightning strikes `target` (what it picked a moment ago), or
   *  whatever is nearest Klayman: a bacteria or a dirtball, never the boss.
   *  A bacteria dies on the spot. A dirtball rolls at the closest bacteria,
   *  or, with none about, straight into the pot's rim. */
  lightning(target = null) {
    const hit = this.strikable(target) ? target : this.nearestOf(this.strikables, this.klay);
    if (!hit) return;
    this.emit('lightning', { x: hit.x, y: hit.y });
    if (hit instanceof Dirtball) {
      const prey = this.nearestOf(this.bacteria.filter((b) => b.alive), hit);
      const away = { x: hit.x - SOIL.cx, y: hit.y - SOIL.cy };
      hit.push(prey ? { x: prey.x - hit.x, y: prey.y - hit.y } : (Math.hypot(away.x, away.y) > 1 ? away : { x: 1, y: 0 }));
      return;
    }
    hit.breakApart();
    this.addScore(SCORE.storm, hit);
    this.killed(hit);
  }

  /** The thing in `list` closest to `p`, or null. */
  nearestOf(list, p) {
    let best = null;
    let bestD = Infinity;
    for (const t of list) {
      const d = dist(t, p);
      if (d < bestD) { best = t; bestD = d; }
    }
    return best;
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
    } else if (this.phase === 'play' && this.timed) {
      this.updateRun(dt);
    } else if (this.phase === 'won') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.over = true;
        this.emit('won', { run: this.run.id, score: this.score });
      }
    } else if (this.phase === 'play') {
      if (this.toSpawn > 0 && !this.frozen && !this.held) {
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
    this.emit('gameover', { score: this.score, level: this.level, run: this.run?.id ?? null, lasted: this.run ? this.run.secs - this.run.left : null });
  }

  /** The backup sprout, if one was picked and it hasn't taken over yet. */
  get backupSprout() { return this.loadout.sprouts[this.sproutIndex + 1] ?? null; }

  /** Hearts a revive brings back: half the hearts the sprout could hold. */
  get reviveHearts() { return Math.floor(this.maxLives) / 2; }

  /** A revive is on offer: the sprout is lost, there's no backup left to
   *  carry on with, and this game hasn't used one. */
  get canRevive() { return this.over && !this.won && this.revivesLeft > 0 && !this.backupSprout; }

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
    if (!this.over || this.won || !this.backupSprout) return false;
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

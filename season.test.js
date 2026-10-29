// Seasons (v22), dirtballs pushed any way, and the round pot. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { BACTERIA, BOSS, DIRTBALL, GADGETS, KLAYMAN, SCORE, SEASONS, SPROUTS, TREE } from './config.js';
import { CATALOG, SAVE, SEASON_IDS, Wallet, gearFor } from './gear.js';
import { SOIL, dist, insideRing, insideSoil, keepOnSoil, rimPoint } from './world.js';
import { Dirtball } from './dirtball.js';
import { bossSpawnEvery } from './boss.js';

const STEP = 1 / 60;
const run = (game, seconds, input = NO_INPUT) => {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
};

/** An empty pot in `season`: no spawning, no coins, Klayman parked away from the sprout. */
function quietGame(season = null, more = {}) {
  const game = new Game({ rng: () => 0.5, loadout: { season, ...more } });
  game.phase = 'test';
  game.toSpawn = 0;
  game.klay.x = SOIL.cx - 120;
  game.klay.y = SOIL.cy + 80;
  game.coinTimer = Infinity;
  return game;
}

function memory() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
}

// ------------------------------------------------------------ the round pot

test('the pot is a perfect circle (v22): soil and rings as deep as they are wide', () => {
  assert.equal(SOIL.rx, SOIL.ry);
  const r = SOIL.rx;
  for (const a of [0, 0.7, Math.PI / 2, 2.4, Math.PI, 4.2]) {
    const p = rimPoint(a);
    assert.ok(Math.abs(dist(p, { x: SOIL.cx, y: SOIL.cy }) - r) < 1e-6, 'every rim point the same distance out');
  }
  assert.equal(insideSoil(SOIL.cx, SOIL.cy + r - 2), true);
  assert.equal(insideSoil(SOIL.cx, SOIL.cy + r + 2), false);
  const p = { x: SOIL.cx + r * 2, y: SOIL.cy + r * 2 };
  keepOnSoil(p);
  assert.ok(Math.abs(dist(p, { x: SOIL.cx, y: SOIL.cy }) - r) < 1e-6, 'pulled straight back to the rim');
  const c = { x: 0, y: 0 };
  assert.equal(insideRing({ x: 0, y: 99 }, c, 100), insideRing({ x: 99, y: 0 }, c, 100));
});

// -------------------------------------------------------- pushed any way

test('a dirtball rolls exactly the way it is pushed, not snapped to 4 or 8 ways', () => {
  const d = new Dirtball(0, 0);
  const way = { x: 3, y: -1 };
  d.push(way);
  assert.ok(Math.abs(Math.atan2(d.vy, d.vx) - Math.atan2(way.y, way.x)) < 1e-9);
  assert.ok(Math.abs(Math.hypot(d.vx, d.vy) - DIRTBALL.speed) < 1e-9, 'at its usual speed');
});

test('Klayman pushes a dirtball the way he aims, at any angle', () => {
  const game = quietGame();
  const k = game.klay;
  const way = { x: Math.cos(-0.5), y: Math.sin(-0.5) };      // up and to the right, about 29 degrees
  const reach = KLAYMAN.radius + DIRTBALL.radius + 2;
  const ball = game.addDirtball(k.x + way.x * reach, k.y + way.y * reach);
  k.lookAlong(way);
  game.update(STEP, { ...NO_INPUT, pressed: true });
  assert.equal(ball.state, 'rolling');
  assert.ok(Math.abs(Math.atan2(ball.vy, ball.vx) + 0.5) < 1e-6, `rolling at ${Math.atan2(ball.vy, ball.vx)}`);
});

// ----------------------------------------------------- the shop and saves

test('five seasons at 169K each, one per game, and a save remembers it', () => {
  assert.deepEqual(SEASON_IDS, ['summer', 'winter', 'spring', 'autumn', 'rainy']);
  for (const id of SEASON_IDS) {
    assert.equal(SEASONS[id].price, 169);
    assert.ok(CATALOG[id].name && CATALOG[id].says);
  }
  const storage = memory();
  const w = new Wallet(storage);
  w.add(400);
  assert.equal(w.loadout.season, null, 'no season to start with');
  assert.equal(w.buy('winter'), true);
  assert.equal(w.loadout.season, 'winter', 'bought straight into use');
  assert.equal(w.equip('summer'), false, 'only what you own');
  w.buy('summer');
  assert.equal(w.loadout.season, 'summer', 'one at a time: the new one swaps in');
  assert.equal(w.isOn('winter'), false);
  const again = new Wallet(storage);
  assert.equal(again.loadout.season, 'summer', 'remembered');
  again.equip('noSeason');
  assert.equal(again.loadout.season, null);
  assert.equal(new Wallet(storage).loadout.season, null);
});

test('a save from before seasons loads with none', () => {
  const storage = memory();
  storage.setItem(SAVE, JSON.stringify({ coins: 5, owned: ['sprout'] }));
  assert.equal(new Wallet(storage).loadout.season, null);
});

// ------------------------------------------------------------------ summer

test('summer (v23): every 50 seconds the sun grows the sprout half a heart, up to 2 more, then stops', () => {
  const game = quietGame('summer');
  assert.deepEqual(game.sproutClocks.map((c) => `${c.power} ${Math.ceil(c.secs)}`), ['sun 50'], 'the glasses count it down');
  run(game, 49.9);
  assert.equal(game.maxLives, 3);
  game.drainEvents();
  run(game, 0.2);
  assert.equal(game.maxLives, 3.5);
  assert.equal(game.lives, 3.5, 'and the new half heart comes full');
  assert.ok(game.drainEvents().some((e) => e.type === 'sunshine'));
  run(game, 150);
  assert.equal(game.maxLives, 5, '+2 after four suns (200 seconds)');
  run(game, 100);
  assert.equal(game.maxLives, 5, 'and no more');
  assert.deepEqual(game.sproutClocks, [], 'nothing left to count down');
});

test('summer raises the sprout’s limit too, so water drops still grow it', () => {
  const game = quietGame('summer');
  game.maxLives = TREE.maxLives;
  game.lives = TREE.maxLives;
  game.useItem({ type: 'water', x: 0, y: 0 });
  assert.equal(game.maxLives, TREE.maxLives, 'at its limit, water does nothing');
  game.sunshine(SEASONS.summer.sun);
  assert.equal(game.maxLives, TREE.maxLives + 0.5);
  game.sunshine(SEASONS.summer.sun);
  game.useItem({ type: 'water', x: 0, y: 0 });
  assert.equal(game.maxLives, TREE.maxLives + 1);
});

// ------------------------------------------------------------------ winter

test('winter (v23): every bacteria crawls 15% slower', () => {
  const crawled = (season) => {
    const game = quietGame(season);
    const b = game.addBacteria(game.tree.x + 300, game.tree.y);
    const d0 = dist(b, game.tree);
    run(game, 2);
    return d0 - dist(b, game.tree);
  };
  const plain = crawled(null);
  const cold = crawled('winter');
  assert.ok(Math.abs(cold / plain - 0.85) < 0.02, `${cold.toFixed(1)} against ${plain.toFixed(1)}`);
});

test('winter and the fertilizer slow bacteria together', () => {
  const game = quietGame('winter', { gadgets: ['fertilizer'] });
  game.update(STEP, { ...NO_INPUT, gadget: 0 });
  assert.ok(Math.abs(game.pace - GADGETS.fertilizer.slowFactor * 0.85) < 1e-9);
  assert.equal(game.fertilized, true);
  assert.equal(quietGame('winter').fertilized, false, 'winter alone isn’t the fertilizer');
});

// ------------------------------------------------------------------ spring

test('spring (v23): every sprout power comes round 15% sooner (its wait is 85% as long)', () => {
  const plain = gearFor({ sprout: 'mushroom' });
  const spring = gearFor({ sprout: 'mushroom', season: 'spring' });
  assert.ok(Math.abs(spring.spores.every - SPROUTS.mushroom.spores.every * 0.85) < 1e-9);
  assert.ok(Math.abs(spring.heal.every - plain.heal.every * 0.85) < 1e-9);
  assert.ok(Math.abs(spring.growEvery - plain.growEvery * 0.85) < 1e-9);
  assert.equal(spring.spores.reach, plain.spores.reach, 'only sooner, no bigger');
  assert.ok(Math.abs(gearFor({ sprout: 'daisy', season: 'spring' }).coinEvery - 30 * 0.85) < 1e-9);
  const corn = gearFor({ sprout: 'corn', season: 'spring' });
  assert.ok(Math.abs(corn.shield.every - 40 * 0.85) < 1e-9);
  assert.equal(corn.shield.time, 15, 'and closed just as long');
  const game = quietGame('spring', { sprouts: ['rose'] });
  game.lives = 3;
  run(game, 16.9);
  assert.equal(game.lives, 3);
  run(game, 0.2);
  assert.equal(game.lives, 4, 'a rose heals at 17 seconds, not 20');
});

// ------------------------------------------------------------------ autumn

test('autumn: dirtballs never crack open', () => {
  const game = quietGame('autumn');
  const ball = game.addDirtball(game.tree.x + 150, game.tree.y);
  run(game, DIRTBALL.holdTime * 4);
  assert.equal(ball.dead, false);
  assert.equal(game.dirtballs.length, 1);
  assert.equal(game.bacteria.length, 0, 'nothing climbs out');
});

test('autumn: dirt takes 50% longer to wear off a bacteria', () => {
  const layerLasts = (season) => {
    const game = quietGame(season);
    const b = game.addBacteria(game.tree.x + 300, game.tree.y);
    b.addDirt(2);
    let t = 0;
    while (b.dirt >= 2) { game.update(STEP); t += STEP; }
    return t;
  };
  assert.ok(Math.abs(layerLasts(null) - BACTERIA.decayTime) < 0.05);
  assert.ok(Math.abs(layerLasts('autumn') - BACTERIA.decayTime * 1.5) < 0.05);
});

// ------------------------------------------------------------------- rainy

test('rainy: every minute lightning kills a bacteria on the spot', () => {
  const game = quietGame('rainy');
  const b = game.addBacteria(game.tree.x + 250, game.tree.y);
  b.speed = 0;
  run(game, 59.9);
  assert.equal(b.alive, true, 'the storm keeps its minute');
  game.drainEvents();
  run(game, 0.2);
  const events = game.drainEvents();
  assert.ok(events.some((e) => e.type === 'lightning'));
  assert.equal(b.alive, false);
  assert.equal(game.score, SCORE.storm);
});

test('rainy: lightning on a dirtball sends it rolling at the closest bacteria', () => {
  const game = quietGame('rainy');
  game.rng = () => 0.99;                                // the last thing in the list: the dirtball
  const near = game.addBacteria(game.tree.x - 200, game.tree.y - 100);
  const far = game.addBacteria(game.tree.x + 300, game.tree.y + 100);
  near.speed = 0;
  far.speed = 0;
  const ball = game.addDirtball(game.tree.x - 60, game.tree.y + 140);
  game.lightning();
  assert.equal(ball.state, 'rolling');
  const toward = Math.atan2(near.y - ball.y, near.x - ball.x);
  assert.ok(Math.abs(Math.atan2(ball.vy, ball.vx) - toward) < 1e-6, 'straight at the closest one');
  run(game, 1.5);
  assert.equal(near.alive, false, 'and smashes it');
  assert.equal(far.alive, true);
});

test('rainy: with no bacteria about, a struck dirtball rolls into the pot’s rim', () => {
  const game = quietGame('rainy');
  const ball = game.addDirtball(SOIL.cx + 100, SOIL.cy);
  game.lightning();
  assert.equal(ball.state, 'rolling');
  assert.ok(ball.vx > 0 && Math.abs(ball.vy) < 1e-9, 'straight out, the nearest way to the rim');
  run(game, 2);
  assert.ok(ball.dead || ball.state === 'breaking', 'it breaks on the rim');
});

test('rainy: nothing to strike, nothing struck; and never the boss', () => {
  const game = quietGame('rainy');
  game.lightning();
  assert.equal(game.drainEvents().some((e) => e.type === 'lightning'), false);
  game.level = BOSS.firstLevel;
  game.bossPlan = { x: SOIL.cx + 200, y: SOIL.cy };
  game.raiseBoss();
  game.boss.spawnTimer = Infinity;
  run(game, 1.2);
  const hp = game.boss.hp;
  game.lightning();
  assert.equal(game.boss.hp, hp);
  assert.equal(game.drainEvents().some((e) => e.type === 'lightning'), false);
});

test('seasons leave the boss alone', () => {
  for (const season of SEASON_IDS) {
    const game = quietGame(season);
    game.level = 10;
    game.bossPlan = { x: SOIL.cx + 200, y: SOIL.cy };
    game.raiseBoss();
    assert.equal(game.boss.maxHp, 100, `${season}: same HP`);
    assert.equal(game.boss.spawnEvery, bossSpawnEvery(10), `${season}: same spawning`);
  }
});

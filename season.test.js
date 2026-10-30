// Seasons (v22; v24: stronger every level, autumn's crack, lightning near
// Klayman), dirtballs pushed any way, and the round pot. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { BACTERIA, BOSS, DIRTBALL, GADGETS, KLAYMAN, SCORE, SEASONS, SEASON_LEVEL_UP, SPROUTS, TREE } from './config.js';
import { CATALOG, SAVE, SEASON_IDS, Wallet, gearFor, seasonAt } from './gear.js';
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

test('autumn (v24): dirtballs do crack open, 2.5 times later; the setup page says twice', () => {
  const game = quietGame('autumn');
  const ball = game.addDirtball(game.tree.x + 150, game.tree.y);
  run(game, DIRTBALL.holdTime * 2.5 - 0.2);
  assert.equal(ball.dead, false, 'still whole at 2.5 times the usual hold, just about');
  run(game, 0.4);
  assert.equal(ball.dead, true, 'and then it cracks');
  assert.equal(game.bacteria.length, 1, 'a very dirty bacteria climbs out');
  assert.equal(SEASONS.autumn.crackHold, 2.5);
  assert.match(CATALOG.autumn.says, /twice as long/, 'the shop promises a little less than it gives');
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
  const near = game.addBacteria(game.tree.x - 200, game.tree.y - 100);
  const far = game.addBacteria(game.tree.x + 300, game.tree.y + 100);
  near.speed = 0;
  far.speed = 0;
  const ball = game.addDirtball(game.klay.x + 40, game.klay.y);   // the thing nearest Klayman
  game.lightning();
  assert.equal(ball.state, 'rolling');
  const toward = Math.atan2(near.y - ball.y, near.x - ball.x);
  assert.ok(Math.abs(Math.atan2(ball.vy, ball.vx) - toward) < 1e-6, 'straight at the closest one');
  run(game, 1.5);
  assert.equal(near.alive, false, 'and smashes it');
  assert.equal(far.alive, true);
});

test('rainy (v24): lightning strikes what is nearest Klayman, not anything anywhere', () => {
  for (const roll of [0, 0.5, 0.99]) {
    const game = quietGame('rainy');
    game.rng = () => roll;                                // no luck in it any more
    const far = game.addBacteria(game.klay.x + 500, game.klay.y - 300);
    const near = game.addBacteria(game.klay.x + 70, game.klay.y - 20);
    const middle = game.addBacteria(game.klay.x - 200, game.klay.y);
    for (const b of [far, near, middle]) b.speed = 0;
    game.lightning();
    assert.equal(near.alive, false, `roll ${roll}: the one by Klayman`);
    assert.equal(far.alive && middle.alive, true);
  }
});

test('rainy (v24): the target is picked 2 seconds early, and that is what gets struck', () => {
  const game = quietGame('rainy');
  const { every, warn } = SEASONS.rainy.storm;
  assert.equal(warn, 2);
  const near = game.addBacteria(game.klay.x + 60, game.klay.y);
  const other = game.addBacteria(game.klay.x - 160, game.klay.y);
  near.speed = 0;
  other.speed = 0;
  run(game, every - warn - 0.1);
  assert.deepEqual(game.stormTargets, [], 'nothing picked until 2 seconds before');
  run(game, 0.2);
  assert.deepEqual(game.stormTargets, [near], 'picked: the one nearest Klayman (the glasses mark it)');
  game.klay.x -= 200;                                   // Klayman walks off: the pick stays
  run(game, 0.5);
  assert.deepEqual(game.stormTargets, [near], 'a pick stays picked');
  run(game, warn - 0.5);
  assert.equal(near.alive, false, 'struck as marked');
  assert.equal(other.alive, true);
  assert.deepEqual(game.stormTargets, [], 'and the next minute starts unpicked');
});

test('rainy (v24): if the marked bacteria is beaten first, the next nearest is marked instead', () => {
  const game = quietGame('rainy');
  const near = game.addBacteria(game.klay.x + 60, game.klay.y);
  const next = game.addBacteria(game.klay.x - 120, game.klay.y);
  near.speed = 0;
  next.speed = 0;
  game.stormTimer = 1.5;
  run(game, 0.1);
  assert.deepEqual(game.stormTargets, [near]);
  game.turnIntoDirtball(near);                          // Klayman got it first
  game.dirtballs[0].push({ x: 0, y: 1 });               // and set it rolling: no longer strikable
  run(game, 0.1);
  assert.deepEqual(game.stormTargets, [next], 'the mark moves on, so the glasses never lie');
  run(game, 1.5);
  assert.equal(next.alive, false);
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

// ------------------------------------------------- stronger every level (v24)

test('every season gets 1% better each level, compounding', () => {
  assert.equal(SEASON_LEVEL_UP, 0.01);
  const less = (v, n) => v * 0.99 ** (n - 1);
  const more = (v, n) => v * 1.01 ** (n - 1);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const n of [1, 2, 10, 25]) {
    assert.ok(near(seasonAt('summer', n).sun.every, less(50, n)), `summer ${n}: the sun comes sooner`);
    assert.ok(near(seasonAt('winter', n).bacteriaPace, less(0.85, n)), `winter ${n}: bacteria slower`);
    assert.ok(near(seasonAt('spring', n).sproutWait, less(0.85, n)), `spring ${n}: shorter waits`);
    assert.ok(near(seasonAt('autumn', n).crackHold, more(2.5, n)), `autumn ${n}: dirtballs hold longer`);
    assert.ok(near(seasonAt('autumn', n).decay, more(1.5, n)), `autumn ${n}: dirt wears off slower`);
    assert.ok(near(seasonAt('rainy', n).storm.every, less(60, n)), `rainy ${n}: lightning sooner`);
  }
  assert.equal(seasonAt('summer', 7).sun.grow, 0.5, 'the sun still grows half a heart');
  assert.equal(seasonAt('summer', 7).sun.max, 2, 'up to 2 more, as before');
  assert.equal(seasonAt('rainy', 7).storm.strikes, 1);
  assert.equal(seasonAt('rainy', 7).storm.warn, 2, 'and the glasses still get 2 seconds');
  assert.deepEqual(seasonAt(null, 9), {}, 'no season: nothing');
  assert.equal(SEASONS.winter.bacteriaPace, 0.85, 'config.js keeps level 1’s numbers');
});

test('a game’s season follows its level: winter at level 11 is 10 steps colder', () => {
  const crawled = (level) => {
    const game = quietGame('winter');
    game.startLevel(level);
    game.phase = 'test';
    game.toSpawn = 0;
    const b = game.addBacteria(game.tree.x + 300, game.tree.y);
    b.speed = BACTERIA.speed;                           // the same bacteria at both levels
    const d0 = dist(b, game.tree);
    run(game, 2);
    return d0 - dist(b, game.tree);
  };
  const ratio = crawled(11) / crawled(1);
  assert.ok(Math.abs(ratio - 0.99 ** 10) < 0.01, `${ratio.toFixed(3)}`);
});

test('spring: at a new level the sprout’s next power waits the new, shorter time', () => {
  const game = quietGame('spring', { sprouts: ['rose'] });
  const at1 = game.gear.heal.every;
  game.startLevel(6);
  assert.ok(Math.abs(game.gear.heal.every - at1 * 0.99 ** 5) < 1e-9);
  const daisy = quietGame('spring', { sprouts: ['daisy'] });
  daisy.startLevel(6);
  assert.ok(Math.abs(daisy.flowerCoins.every - 30 * 0.85 * 0.99 ** 5) < 1e-9, 'a daisy’s coins too');
  const plain = quietGame(null, { sprouts: ['rose'] });
  plain.startLevel(6);
  assert.equal(plain.gear.heal.every, SPROUTS.rose.heal.every, 'no season: no change with the level');
});

test('autumn at level 11: dirtballs hold 2.5 x 1.01^10 times as long', () => {
  const game = quietGame('autumn');
  game.startLevel(11);
  const ball = game.addDirtball(game.tree.x + 150, game.tree.y);
  assert.ok(Math.abs(ball.hold - DIRTBALL.holdTime * 2.5 * 1.01 ** 10) < 1e-9);
});

// The boss bacteria at levels 10, 15, 20, ... Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { BOSS, COINS, ITEMS, SCORE } from './config.js';
import { Boss, bossHp, bossSpawnEvery, isBossLevel } from './boss.js';
import { SOIL, dist, insideSoil } from './world.js';

const STEP = 1 / 60;
const run = (game, seconds, input = NO_INPUT) => {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
};

/** A boss level with its own bacteria already beaten. Its boss rises in
 *  the top-left corner, so the pot's middle is below it. */
function bossGame(level = 10, { tools = [], rng = () => 0.1 } = {}) {
  const game = new Game({ rng, loadout: { tools } });
  game.reset(undefined, level);
  game.phase = 'play';
  game.toSpawn = 0;
  game.coinTimer = Infinity;
  game.potItems.timer = Infinity;
  game.klay.x = SOIL.cx;
  game.klay.y = SOIL.cy + 120;
  return game;
}

/** Runs until the boss is up and fighting. */
function raise(game) {
  run(game, BOSS.warn + BOSS.rise + 0.1);
  assert.equal(game.boss?.state, 'active');
  return game.boss;
}

test('bosses come at levels 5, 10, 15, 20 ...', () => {
  const levels = Array.from({ length: 40 }, (_, i) => i + 1).filter(isBossLevel);
  assert.deepEqual(levels, [5, 10, 15, 20, 25, 30, 35, 40]);
});

test('a boss has level x 10 HP', () => {
  assert.deepEqual([5, 10, 15, 20, 35].map(bossHp), [50, 100, 150, 200, 350]);
});

test('it sends out a bacteria every 2.5s at 10, 1.875s at 15, 1.25s at 20, 1s from 25 on (3.125s at 5)', () => {
  assert.deepEqual([5, 10, 15, 20, 25, 30, 45].map(bossSpawnEvery), [3.125, 2.5, 1.875, 1.25, 1, 1, 1]);
});

test('it rises right in a corner: closer to the rim than before, still standing on the soil', () => {
  const game = bossGame();
  assert.equal(BOSS.corner, 70);
  for (const roll of [0, 0.3, 0.6, 0.9]) {
    game.rng = () => roll;
    game.klay.x = SOIL.cx; game.klay.y = SOIL.cy;
    const c = game.planBoss();
    const boss = new Boss(c.x, c.y, { hp: 1, spawnEvery: 1 });
    const middle = boss.aimPoint;
    assert.ok(insideSoil(middle.x, middle.y, 30), 'its middle is on the soil, with room to spare');
    // Its front and inner sides, where Klayman and the bacteria come at it from, are on the soil.
    const inward = { x: Math.sign(SOIL.cx - c.x), y: Math.sign(SOIL.cy - c.y) };
    assert.ok(insideSoil(middle.x + inward.x * BOSS.foot.rx, middle.y), 'inner side');
    assert.ok(insideSoil(middle.x, middle.y + inward.y * BOSS.foot.ry), 'front or back');
    assert.ok(Math.hypot((c.x - SOIL.cx) / SOIL.rx, (c.y - SOIL.cy) / SOIL.ry) > 0.75, 'out toward the rim');
  }
});

test('it rises from a corner only once the level’s own bacteria are gone', () => {
  const game = bossGame();
  const b = game.addBacteria(SOIL.cx - 200, SOIL.cy);
  run(game, 1);
  assert.equal(game.bossPlan, null, 'not while a bacteria is out');
  b.state = 'gone'; b.dead = true;
  game.drainEvents();
  run(game, STEP * 2);
  assert.ok(game.bossPlan, 'the ground rumbles where it will rise');
  assert.ok(game.drainEvents().some((e) => e.type === 'bossComing'));
  const plan = { ...game.bossPlan };
  run(game, BOSS.warn);
  assert.ok(game.boss);
  assert.deepEqual({ x: game.boss.x, y: game.boss.y }, plan, 'it rises where the rumble was');
  // A corner: off to a diagonal of the pot, well away from its middle.
  assert.ok(Math.abs(plan.x - SOIL.cx) > 200 && Math.abs(plan.y - SOIL.cy) > 100, 'in a corner');
  assert.equal(game.phase, 'play', 'and the level is not cleared');
});

test('the corner is picked at random, never where Klayman stands', () => {
  const spots = new Set();
  for (const roll of [0, 0.3, 0.6, 0.9]) {
    const game = bossGame(10, { rng: () => roll });
    game.klay.x = SOIL.cx; game.klay.y = SOIL.cy;
    spots.add(JSON.stringify(game.planBoss()));
  }
  assert.equal(spots.size, 4, 'all four corners come up');
  const game = bossGame();
  const corner = game.planBoss();
  game.klay.x = corner.x; game.klay.y = corner.y;
  for (let i = 0; i < 10; i++) assert.ok(dist(game.planBoss(), game.klay) > 220);
});

test('no boss on other levels', () => {
  for (const level of [9, 11, 14]) {
    const game = bossGame(level);
    run(game, BOSS.warn + 2);
    assert.equal(game.boss, null);
    assert.ok(game.phase === 'clear' || game.level === level + 1, `level ${level} clears`);
  }
});

test('it never moves, sends out bacteria toward the sprout, and is 4x a bacteria', () => {
  const game = bossGame(20);
  const boss = raise(game);
  const at = { x: boss.x, y: boss.y };
  game.drainEvents();
  run(game, 1.3);
  const sent = game.drainEvents().filter((e) => e.type === 'bossSpawn');
  assert.equal(sent.length, 1, 'one every 1.25 seconds at level 20');
  assert.deepEqual({ x: boss.x, y: boss.y }, at, 'still where it rose');
  const minion = game.bacteria[0];
  assert.ok(insideSoil(minion.x, minion.y));
  assert.ok(dist(minion, game.tree) < dist(boss, game.tree), 'out of its side facing the sprout');
  assert.equal(BOSS.size, 4);
  assert.ok(BOSS.foot.rx >= 13 * 4, 'it stands on 4x the ground a bacteria does');
});

test('throws take 1 HP (1.5 with the bag); a rolling dirtball takes 5', () => {
  const game = bossGame(10);
  const boss = raise(game);
  game.bacteria = [];
  game.boss.spawnTimer = Infinity;
  const k = game.klay;
  k.x = boss.x; k.y = boss.y + 110;             // just in front of it
  k.lookAlong({ x: 0, y: -1 });
  game.update(STEP, { ...NO_INPUT, pressed: true });
  run(game, 0.5);
  assert.equal(boss.hp, 99);
  game.bag = ITEMS.bag.time;
  game.update(STEP, { ...NO_INPUT, pressed: true });
  run(game, 0.5);
  assert.equal(boss.hp, 97.5);
  game.bag = 0;
  const ball = game.addDirtball(boss.x, boss.y + 80);
  ball.push({ x: 0, y: -1 });
  run(game, 0.4);
  assert.equal(boss.hp, 92.5);
  assert.ok(ball.dead || ball.state === 'breaking', 'and the dirtball breaks on it');
});

test('Klayman can’t walk over it, and bacteria crawl round it', () => {
  const game = bossGame();
  const boss = raise(game);
  boss.spawnTimer = Infinity;
  const k = game.klay;
  k.x = boss.x; k.y = boss.y + 120;
  run(game, 2, { ...NO_INPUT, y: -1 });
  assert.equal(boss.touches(k), false, 'he stops at its edge');
  assert.ok(k.y > boss.y, 'still in front of it');
});

test('worn out, it gets tired, burrows back down, and a 10K coin pops out of the ground', () => {
  const game = bossGame(10);
  const boss = raise(game);
  boss.spawnTimer = Infinity;
  game.drainEvents();
  game.hitBoss(boss.hp, boss);
  assert.equal(boss.state, 'tired');
  assert.equal(game.score, SCORE.boss);
  assert.equal(boss.lockable, false, 'the gun lets go of it');
  run(game, BOSS.tired + 0.05);
  assert.equal(boss.state, 'burrowing');
  run(game, BOSS.burrow);
  assert.equal(game.boss, null, 'back in the ground');
  const coin = game.coins.find((c) => c.value === BOSS.coin);
  assert.ok(coin, 'a 10K coin');
  assert.equal(BOSS.coin, 10);
  assert.equal(coin.landed, false, 'popping out of the ground first');
  assert.deepEqual({ x: coin.from.x, y: coin.from.y }, { x: boss.x, y: boss.y });
  run(game, COINS.coinFlight);
  assert.equal(coin.landed, true);
});

test('the level is cleared once the boss is down and the pot is empty', () => {
  const game = bossGame(10);
  const boss = raise(game);
  run(game, 3);
  assert.ok(game.bacteria.length > 0, 'it sent bacteria out');
  game.hitBoss(boss.hp, boss);
  run(game, BOSS.tired + BOSS.burrow + 0.1);
  assert.equal(game.phase, 'play', 'not while its bacteria are still out');
  for (const b of game.bacteria) { b.state = 'gone'; b.dead = true; }
  run(game, 0.1);
  assert.equal(game.phase, 'clear');
  run(game, 2);
  assert.equal(game.level, 11);
});

test('the glasses count the boss as one bacteria left until it’s worn out', () => {
  const game = bossGame(10);
  assert.equal(game.bacteriaLeft, 1);
  const boss = raise(game);
  assert.equal(game.bacteriaLeft, 1);
  game.hitBoss(boss.hp, boss);
  assert.equal(game.bacteriaLeft, 0);
});

test('a sandclock holds the boss too', () => {
  const game = bossGame(10);
  const boss = raise(game);
  game.useItem({ type: 'sandclock', x: 0, y: 0 });
  game.drainEvents();
  run(game, ITEMS.sandclockTime - 0.2);
  assert.equal(game.drainEvents().filter((e) => e.type === 'bossSpawn').length, 0);
  assert.equal(boss.state, 'active');
});

test('the dirt gun locks on to the boss, measured to its edge', () => {
  const game = bossGame(10, { tools: ['gun'] });
  const boss = raise(game);
  boss.spawnTimer = Infinity;
  game.bacteria = [];
  const k = game.klay;
  k.x = boss.x; k.y = boss.y + BOSS.foot.ry + 60;   // its middle is out of reach, its edge isn't
  assert.ok(dist(boss.aimPoint, k) > game.shotRange * 0.5);
  game.update(STEP, { ...NO_INPUT, pressed: true });
  assert.equal(game.lock, boss);
  run(game, 0.6);
  assert.ok(boss.hp < boss.maxHp, 'and the shot lands');
});

test('the boss’s footprint: inside, outside, pushed out', () => {
  const boss = new Boss(500, 500, { hp: 10, spawnEvery: 1 });
  assert.equal(boss.touches({ x: 500, y: 490 }), true);
  assert.equal(boss.touches({ x: 500 + BOSS.foot.rx + 5, y: 480 }), false);
  const p = { x: 520, y: 485 };
  boss.pushOut(p, 11);
  assert.ok(Math.abs(boss.reachOf(p, 11) - 1) < 1e-9, 'right on its edge');
  assert.equal(boss.gap({ x: 500, y: 500 }), 0);
});

test('while a boss is out, thrown dirt flies past dirtballs; a push still breaks them on it', () => {
  const game = bossGame(10, { tools: ['gun'] });
  const boss = raise(game);
  boss.spawnTimer = Infinity;
  const k = game.klay;
  k.x = boss.x + 40; k.y = boss.y + 190;
  k.lookAlong({ x: 0, y: 1 });
  const ball = game.addDirtball(k.x, k.y + 90);
  game.update(STEP, { ...NO_INPUT, pressed: true });
  assert.notEqual(game.lock, ball, 'the gun doesn’t lock on to it');
  run(game, 0.6);
  assert.equal(ball.state, 'idle', 'the dirt flew past');
  assert.equal(game.shotsBreakBalls, false);
  // Pushed into the boss, it still breaks, and hurts it.
  const push = game.addDirtball(boss.x, boss.y + 90);
  push.push({ x: 0, y: -1 });
  run(game, 0.4);
  assert.ok(push.dead || push.state === 'breaking');
  assert.ok(boss.hp <= boss.maxHp - BOSS.ballDamage);
  // Once the boss is gone, dirt breaks dirtballs again.
  game.hitBoss(boss.hp, boss);
  run(game, BOSS.tired + BOSS.burrow + 0.1);
  assert.equal(game.bossTime, false);
  assert.equal(game.shotsBreakBalls, true);
});

test('the first boss comes at level 5, with 50 HP', () => {
  const game = bossGame(5);
  const boss = raise(game);
  assert.equal(boss.maxHp, 50);
  assert.equal(boss.spawnEvery, 3.125);
});

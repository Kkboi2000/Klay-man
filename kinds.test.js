// Yellow and blue bacteria (v27). Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT, dealKinds } from './game.js';
import { BACTERIA, KINDS, KLAYMAN, POISON, TREE, UNIT } from './config.js';
import { Spitter, Stomper } from './bacteria.js';
import { SOIL, dist } from './world.js';

const STEP = 1 / 60;
const run = (game, seconds, input = NO_INPUT) => {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
};
const count = (deck) => deck.reduce((n, k) => ({ ...n, [k]: (n[k] ?? 0) + 1 }), {});

/** An empty pot: no spawning, no coins. */
function quietGame(loadout) {
  const game = new Game({ rng: () => 0.5, loadout });
  game.phase = 'test';
  game.toSpawn = 0;
  game.coinTimer = Infinity;
  return game;
}

// ------------------------------------------------------------ how many

test('a level’s bacteria: 15% blue from level 10, 10% yellow from level 20, the rest green, shuffled', () => {
  const kinds = (level) => {
    const game = new Game({ rng: () => 0.5 });
    game.reset(undefined, level);
    return count(game.kindDeck);
  };
  assert.deepEqual(kinds(9), { green: 21 });
  assert.deepEqual(kinds(10), { green: 20, blue: 3 }, '23 bacteria: 15% is 3');
  assert.deepEqual(kinds(19), { green: 35, blue: 6 });
  assert.deepEqual(kinds(20), { green: 33, yellow: 4, blue: 6 }, '43 bacteria: 4 yellow, 6 blue');
  const deck = dealKinds(20, { yellow: 0.1, blue: 0.15 }, Math.random);
  assert.equal(deck.length, 20);
  assert.deepEqual(count(deck), { green: 15, yellow: 2, blue: 3 });
});

test('a boss sends out yellow ones from level 25, blue from 35; timer runs of 3 and 5 minutes have yellow', () => {
  const bossKinds = (level) => {
    const game = new Game({ rng: () => 0.5 });
    game.reset(undefined, level);
    return count(Array.from({ length: 20 }, () => game.nextBossKind()));
  };
  assert.deepEqual(bossKinds(20), { green: 20 });
  assert.deepEqual(bossKinds(25), { green: 18, yellow: 2 });
  assert.deepEqual(bossKinds(35), { green: 15, yellow: 2, blue: 3 });
  const runKinds = (id) => {
    const game = new Game({ rng: () => 0.5 });
    game.reset(undefined, 1, id);
    return count(Array.from({ length: 40 }, () => game.nextKind()));
  };
  assert.deepEqual(runKinds('t1'), { green: 40 });
  assert.deepEqual(runKinds('t3'), { green: 36, yellow: 4 });
  assert.deepEqual(runKinds('t5'), { green: 36, yellow: 4 });
});

test('a spawned bacteria takes the next kind off the deck', () => {
  const game = new Game({ rng: () => 0.5 });
  game.reset(undefined, 20);
  const want = game.kindDeck.at(-1);
  game.spawnOne();
  assert.equal(game.bacteria[0].kind, want);
});

// ---------------------------------------------------------------- yellow

test('yellow: it bounces after Klayman, never into the sprout, and stops in reach', () => {
  const game = quietGame();
  const k = game.klay;
  k.x = SOIL.cx + 250; k.y = SOIL.cy;
  const y = game.addBacteria(game.tree.x - 40, game.tree.y, 'yellow');
  assert.ok(y instanceof Spitter);
  y.speed = 60;
  const lives = game.lives;
  run(game, 8);
  assert.equal(game.lives, lives, 'the sprout is never touched');
  assert.ok(dist(y, k) <= KINDS.yellow.reach, 'in reach of Klayman');
  assert.ok(dist(y, k) > KLAYMAN.radius + BACTERIA.radius, 'but not on him');
});

test('yellow: in reach, it charges a germ for 1 second, standing still, then spits; one every 5 seconds', () => {
  const game = quietGame();
  const k = game.klay;
  const y = game.addBacteria(k.x + 45, k.y, 'yellow');
  game.update(STEP);
  assert.ok(y.charging > 0, 'charging');
  const x0 = y.x;
  run(game, 0.9);
  assert.equal(y.x, x0, 'standing still');
  assert.equal(game.germs.length, 0);
  run(game, 0.15);
  assert.equal(y.charging, 0);
  const spat = game.germs.length + (k.poisoned ? 1 : 0);
  assert.equal(spat, 1, 'a germ');
  k.stun = k.slow = 0;                       // out of it, to count the next
  run(game, KINDS.yellow.every - KINDS.yellow.charge - 0.1);
  assert.equal(y.charging, 0, 'not yet');
  run(game, 0.2);
  assert.ok(y.charging > 0, 'five seconds on, it charges again');
});

test('yellow: a germ on Klayman poisons him, yellow: 20% slower still, and 20% longer', () => {
  const game = quietGame();
  const k = game.klay;
  game.addBacteria(k.x + 45, k.y, 'yellow');
  game.drainEvents();
  run(game, 1.5);
  const hit = game.drainEvents().find((e) => e.type === 'poison');
  assert.ok(hit, 'hit');
  assert.equal(hit.kind, 'yellow');
  assert.equal(k.poisonKind, 'yellow');
  assert.ok(Math.abs(k.slowFactor - POISON.slowFactor * 0.8) < 1e-9);
  assert.ok(Math.abs(KINDS.yellow.poison.slow - POISON.slow * 1.2) < 1e-9);
  assert.ok(Math.abs(KINDS.yellow.poison.stun - POISON.stun * 1.2) < 1e-9);
});

test('yellow: a germ can be dodged; the lab coat keeps it out; it never gets inside him', () => {
  const dodge = quietGame();
  const k = dodge.klay;
  const y = dodge.addBacteria(k.x + 45, k.y, 'yellow');
  run(dodge, 1.02);
  y.speed = 0;
  run(dodge, 0.6, { ...NO_INPUT, y: 1 });     // he walks away as it flies
  assert.equal(k.poisoned, false, 'dodged');

  const coat = quietGame({ tools: ['coat'] });
  coat.addBacteria(coat.klay.x + 45, coat.klay.y, 'yellow');
  coat.drainEvents();
  run(coat, 1.5);
  assert.equal(coat.klay.poisoned, false);
  assert.ok(coat.drainEvents().some((e) => e.type === 'germBlocked'));

  const touch = quietGame();
  const t = touch.addBacteria(touch.klay.x + 2, touch.klay.y, 'yellow');
  t.charging = 0; t.cooldown = 99;
  run(touch, 0.5);
  assert.equal(t.alive, true, 'touching him, it stays out');
});

test('a dirtball keeps its kind: what climbs out is yellow again', () => {
  const game = quietGame();
  const y = game.addBacteria(SOIL.cx - 200, SOIL.cy, 'yellow');
  y.addDirt(BACTERIA.maxDirt);
  game.turnIntoDirtball(y);
  const ball = game.dirtballs[0];
  assert.equal(ball.kind, 'yellow');
  run(game, ball.hold + 0.1);
  assert.equal(game.bacteria.at(-1).kind, 'yellow');
});

// ------------------------------------------------------------------ blue

test('blue: it walks to dirt, never near the sprout, and every 5 seconds stamps a layer off', () => {
  const game = quietGame();
  game.klay.x = SOIL.cx + 260; game.klay.y = SOIL.cy;
  const dirty = game.addBacteria(SOIL.cx - 150, SOIL.cy - 120);
  dirty.speed = 0;
  dirty.decayTime = Infinity;              // only the stamps take it off
  dirty.addDirt(3);
  const b = game.addBacteria(SOIL.cx - 150, SOIL.cy + 120, 'blue');
  assert.ok(b instanceof Stomper);
  b.speed = 60;
  game.drainEvents();
  let closest = Infinity;
  for (let t = 0; t < 6; t += STEP) {
    game.update(STEP);
    closest = Math.min(closest, dist(b, game.tree));
  }
  assert.ok(closest >= KINDS.blue.keepOff - 10, `kept clear of the sprout (${Math.round(closest)})`);
  assert.ok(dist(b, dirty) <= KINDS.blue.reach, 'in reach of the dirt');
  const stomp = game.drainEvents().find((e) => e.type === 'stomp');
  assert.ok(stomp, 'stamped');
  assert.equal(stomp.steam.length, 1, 'steam off what it stamped');
  assert.equal(dirty.dirt, 2, 'one layer off');
  run(game, KINDS.blue.every);
  assert.equal(dirty.dirt, 1, 'and another five seconds on');
});

test('blue: a stamp takes a layer’s worth off a dirtball’s hold; a clean bacteria crawls again', () => {
  const game = quietGame();
  game.klay.x = SOIL.cx + 260; game.klay.y = SOIL.cy;
  const ball = game.addDirtball(SOIL.cx - 150, SOIL.cy - 120);
  const b = game.addBacteria(ball.x + 30, ball.y, 'blue');
  b.cooldown = 0;
  const hold = ball.hold;
  game.update(STEP);
  assert.ok(Math.abs(ball.hold - (hold - KINDS.blue.hold - STEP)) < 1e-6);
  const g = game.addBacteria(b.x + 20, b.y + 20);
  g.addDirt(1);
  b.cooldown = 0;
  game.update(STEP);
  assert.equal(g.state, 'crawl', 'stamped clean');
  assert.equal(b.invades, false);
  assert.equal(KINDS.blue.reach, 10 * UNIT);
});

test('green bacteria are as they were: they go for the sprout', () => {
  const game = quietGame();
  game.klay.x = SOIL.cx + 260; game.klay.y = SOIL.cy;
  const g = game.addBacteria(game.tree.x + 40, game.tree.y);
  assert.equal(g.kind, 'green');
  const lives = game.lives;
  run(game, 4);
  assert.equal(game.lives, lives - 1);
  assert.ok(TREE.radius > 0);
});

// ------------------------------------------------------ bazoo-klay (v27)

import { SHOT, TOOLS, SCORE } from './config.js';
import { CATALOG } from './gear.js';

/** Klayman with the bazoo-klay, facing right, and a pot to aim into. */
function bazooGame() {
  const game = quietGame({ tools: ['bazoo'] });
  game.klay.x = SOIL.cx - 300; game.klay.y = SOIL.cy + 150;   // well clear of the sprout
  game.klay.lookAlong({ x: 1, y: 0 });
  return game;
}
const fire = (game) => game.update(STEP, { ...NO_INPUT, pressed: true });

test('bazoo-klay: 299K; a wave of dirt 40° wide, 10% shorter and 15% slower than a throw', () => {
  assert.equal(TOOLS.bazoo.price, 299);
  assert.equal(CATALOG.bazoo.name, 'Bazoo-klay');
  const game = bazooGame();
  fire(game);
  assert.equal(game.shots.length, 0, 'no ball of dirt');
  const w = game.waves[0];
  assert.ok(w, 'a wave');
  assert.ok(Math.abs(w.range - SHOT.range * 0.9) < 1e-9);
  assert.ok(Math.abs(w.speed - SHOT.speed * 0.85) < 1e-9);
  const k = game.klay;
  const inside = game.addBacteria(k.x + 120, k.y + Math.tan((18 * Math.PI) / 180) * 120);
  const outside = game.addBacteria(k.x + 120, k.y + Math.tan((30 * Math.PI) / 180) * 120);
  const beyond = game.addBacteria(k.x + SHOT.range * 0.9 + 40, k.y);
  for (const b of [inside, outside, beyond]) b.speed = 0;
  run(game, 1);
  assert.equal(inside.state, 'dirty', 'inside the fan: hit');
  assert.equal(outside.state, 'crawl', 'outside it: missed');
  assert.equal(beyond.state, 'crawl', 'past its range: missed');
});

test('bazoo-klay: one wave hits everything in its fan; three make a dirtball', () => {
  const game = bazooGame();
  const k = game.klay;
  const row = [60, 90, 120].map((dx) => game.addBacteria(k.x + dx, k.y + (dx - 90) / 3));
  for (const b of row) { b.speed = 0; b.decayTime = Infinity; }
  for (let i = 0; i < 2; i++) { fire(game); run(game, 0.8); }
  assert.ok(row.every((b) => b.state === 'dirty'), 'all three, each time');
  assert.equal(game.dirtballs.length, 0, 'two waves: not yet');
  fire(game);
  run(game, 0.8);
  assert.equal(game.dirtballs.length, 3, 'three waves: three dirtballs');
});

test('bazoo-klay: a clean bacteria is knocked back 3 units; one already in dirt isn’t, nor a dirtball', () => {
  const game = bazooGame();
  const k = game.klay;
  const clean = game.addBacteria(k.x + 80, k.y);
  const dirty = game.addBacteria(k.x + 80, k.y + 40);
  dirty.addDirt(1);
  clean.speed = dirty.speed = 0;
  const ball = game.addDirtball(k.x + 140, k.y - 20);
  const [cx, dx, bx] = [clean.x, dirty.x, ball.x];
  fire(game);
  run(game, 0.8);
  assert.ok(Math.abs(clean.x - cx - TOOLS.bazoo.knock) < 2, `knocked back ${Math.round(clean.x - cx)}`);
  assert.equal(dirty.x, dx, 'in dirt: stays put');
  assert.equal(ball.x, bx, 'the dirtball: stays put');
  assert.equal(ball.state, 'idle', 'and whole');
  assert.equal(game.score, 0);
  assert.ok(SCORE.dirtball > 0);
});

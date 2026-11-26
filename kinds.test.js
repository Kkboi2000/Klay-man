// Orange and blue bacteria (v27). Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT, dealKinds } from './game.js';
import { BACTERIA, GADGETS, KINDS, KLAYMAN, POISON, TREE, UNIT } from './config.js';
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

test('a level’s bacteria: 15% blue from level 10, 10% orange from level 20, the rest green, shuffled', () => {
  const kinds = (level) => {
    const game = new Game({ rng: () => 0.5 });
    game.reset(undefined, level);
    return count(game.kindDeck);
  };
  assert.deepEqual(kinds(9), { green: 21 });
  assert.deepEqual(kinds(10), { green: 20, blue: 3 }, '23 bacteria: 15% is 3');
  assert.deepEqual(kinds(19), { green: 35, blue: 6 });
  assert.deepEqual(kinds(20), { green: 33, orange: 4, blue: 6 }, '43 bacteria: 4 orange, 6 blue');
  const deck = dealKinds(20, { orange: 0.1, blue: 0.15 }, Math.random);
  assert.equal(deck.length, 20);
  assert.deepEqual(count(deck), { green: 15, orange: 2, blue: 3 });
});

test('a boss sends out orange ones from level 25, blue from 35; timer runs of 3 and 5 minutes have orange', () => {
  const bossKinds = (level) => {
    const game = new Game({ rng: () => 0.5 });
    game.reset(undefined, level);
    return count(Array.from({ length: 20 }, () => game.nextBossKind()));
  };
  assert.deepEqual(bossKinds(20), { green: 20 });
  assert.deepEqual(bossKinds(25), { green: 18, orange: 2 });
  assert.deepEqual(bossKinds(35), { green: 15, orange: 2, blue: 3 });
  const runKinds = (id) => {
    const game = new Game({ rng: () => 0.5 });
    game.reset(undefined, 1, id);
    return count(Array.from({ length: 40 }, () => game.nextKind()));
  };
  assert.deepEqual(runKinds('t1'), { green: 40 });
  assert.deepEqual(runKinds('t3'), { green: 36, orange: 4 });
  assert.deepEqual(runKinds('t5'), { green: 36, orange: 4 });
});

test('a spawned bacteria takes the next kind off the deck', () => {
  const game = new Game({ rng: () => 0.5 });
  game.reset(undefined, 20);
  const want = game.kindDeck.at(-1);
  game.spawnOne();
  assert.equal(game.bacteria[0].kind, want);
});

// ---------------------------------------------------------------- orange

test('orange: it bounces after Klayman, never into the sprout, and stops in reach', () => {
  const game = quietGame();
  const k = game.klay;
  k.x = SOIL.cx + 250; k.y = SOIL.cy;
  const y = game.addBacteria(game.tree.x - 40, game.tree.y, 'orange');
  assert.ok(y instanceof Spitter);
  y.speed = 60;
  const lives = game.lives;
  run(game, 8);
  assert.equal(game.lives, lives, 'the sprout is never touched');
  assert.ok(dist(y, k) <= KINDS.orange.reach, 'in reach of Klayman');
  assert.ok(dist(y, k) > KLAYMAN.radius + BACTERIA.radius, 'but not on him');
});

test('orange: in reach, it charges a germ for 1 second, standing still, then spits; one every 5 seconds', () => {
  const game = quietGame();
  const k = game.klay;
  const y = game.addBacteria(k.x + 45, k.y, 'orange');
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
  run(game, KINDS.orange.every - KINDS.orange.charge - 0.1);
  assert.equal(y.charging, 0, 'not yet');
  run(game, 0.2);
  assert.ok(y.charging > 0, 'five seconds on, it charges again');
});

test('orange: a germ on Klayman poisons him, orange: 20% slower still, and 20% longer', () => {
  const game = quietGame();
  const k = game.klay;
  game.addBacteria(k.x + 45, k.y, 'orange');
  game.drainEvents();
  run(game, 1.5);
  const hit = game.drainEvents().find((e) => e.type === 'poison');
  assert.ok(hit, 'hit');
  assert.equal(hit.kind, 'orange');
  assert.equal(k.poisonKind, 'orange');
  assert.ok(Math.abs(k.slowFactor - POISON.slowFactor * 0.8) < 1e-9);
  assert.ok(Math.abs(KINDS.orange.poison.slow - POISON.slow * 1.2) < 1e-9);
  assert.ok(Math.abs(KINDS.orange.poison.stun - POISON.stun * 1.2) < 1e-9);
});

test('orange: a germ can be dodged; the lab coat keeps it out; it never gets inside him', () => {
  const dodge = quietGame();
  const k = dodge.klay;
  const y = dodge.addBacteria(k.x + 45, k.y, 'orange');
  run(dodge, 1.02);
  y.speed = 0;
  run(dodge, 0.6, { ...NO_INPUT, y: 1 });     // he walks away as it flies
  assert.equal(k.poisoned, false, 'dodged');

  const coat = quietGame({ tools: ['coat'] });
  coat.addBacteria(coat.klay.x + 45, coat.klay.y, 'orange');
  coat.drainEvents();
  run(coat, 1.5);
  assert.equal(coat.klay.poisoned, false);
  assert.ok(coat.drainEvents().some((e) => e.type === 'germBlocked'));

  const touch = quietGame();
  const t = touch.addBacteria(touch.klay.x + 2, touch.klay.y, 'orange');
  t.charging = 0; t.cooldown = 99;
  run(touch, 0.5);
  assert.equal(t.alive, true, 'touching him, it stays out');
});

test('a dirtball keeps its kind: what climbs out is orange again', () => {
  const game = quietGame();
  const y = game.addBacteria(SOIL.cx - 200, SOIL.cy, 'orange');
  y.addDirt(BACTERIA.maxDirt);
  game.turnIntoDirtball(y);
  const ball = game.dirtballs[0];
  assert.equal(ball.kind, 'orange');
  run(game, ball.hold + 0.1);
  assert.equal(game.bacteria.at(-1).kind, 'orange');
});

// ------------------------------------------------------------------ blue

test('blue (v28): it waddles to dirt, never near the sprout, and jumps to stamp a layer off when it lands; 3 times as often as v27, from 4 times as far', () => {
  assert.equal(KINDS.blue.reach, 40 * UNIT);
  assert.ok(Math.abs(KINDS.blue.every - 5 / 3) < 1e-9);
  const game = quietGame();
  game.klay.x = SOIL.cx + 260; game.klay.y = SOIL.cy;
  const dirty = game.addBacteria(SOIL.cx - 150, SOIL.cy - 200);
  dirty.speed = 0;
  dirty.decayTime = Infinity;              // only the stamps take it off
  dirty.addDirt(3);
  const b = game.addBacteria(SOIL.cx - 150, SOIL.cy + 250, 'blue');
  assert.ok(b instanceof Stomper);
  b.speed = 60;
  game.drainEvents();
  let closest = Infinity;
  let jumped = null;
  for (let t = 0; t < 5 && dirty.dirt === 3; t += STEP) {
    game.update(STEP);
    closest = Math.min(closest, dist(b, game.tree));
    if (b.jumping && jumped === null) jumped = t;
  }
  assert.ok(closest >= KINDS.blue.keepOff - 10, `kept clear of the sprout (${Math.round(closest)})`);
  assert.ok(dist(b, dirty) <= KINDS.blue.reach, 'in reach of the dirt');
  assert.ok(dist(b, dirty) > 10 * UNIT * 2, 'from well off');
  const events = game.drainEvents();
  assert.ok(events.some((e) => e.type === 'jump'), 'it jumped...');
  assert.ok(events.some((e) => e.type === 'stomp'), '...landed...');
  assert.ok(events.some((e) => e.type === 'zap'), '...and shot at the dirt');
  assert.ok(events.some((e) => e.type === 'zapHit'), 'the shot got there: steam');
  assert.equal(dirty.dirt, 2, 'one layer off');
  run(game, KINDS.blue.every + 0.05);
  assert.equal(dirty.dirt, 1, 'and another 1.67 seconds on');
});

test('blue: the stamp comes as it lands, not as it leaves the ground; then a bounce', () => {
  const game = quietGame();
  game.klay.x = SOIL.cx + 260; game.klay.y = SOIL.cy;
  const ball = game.addDirtball(SOIL.cx - 150, SOIL.cy - 120);
  const b = game.addBacteria(ball.x + 30, ball.y, 'blue');
  b.cooldown = 0;
  const hold = ball.hold;
  game.update(STEP);
  assert.ok(b.jumping, 'up it goes');
  assert.ok(Math.abs(ball.hold - (hold - STEP)) < 1e-6, 'nothing yet');
  run(game, KINDS.blue.land - 0.05);
  assert.ok(b.lift > 0, 'in the air');
  assert.equal(game.zaps.length, 0, 'no shot yet');
  run(game, 0.1);
  assert.equal(game.zaps.length + (ball.hold < hold - KINDS.blue.hold ? 1 : 0), 1, 'landed: a shot at the dirtball');
  assert.ok(b.jumping && b.lift > 0, 'and the bounce');
  run(game, 0.2);
  assert.ok(ball.hold < hold - KINDS.blue.hold, 'the shot got there: a layer’s worth off the hold');
  run(game, KINDS.blue.jump);
  assert.equal(b.jumping, false, 'down for good');
  const g = game.addBacteria(b.x + 20, b.y + 20);
  g.addDirt(1);
  b.cooldown = 0;
  run(game, KINDS.blue.land + 0.3);
  assert.equal(g.state, 'crawl', 'shot clean');
  assert.equal(b.invades, false);
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

test('bazoo-klay: 299K; a wave of dirt 40° wide, 63% as far as a throw (v28) and 15% slower', () => {
  assert.equal(TOOLS.bazoo.price, 299);
  assert.equal(CATALOG.bazoo.name, 'Bazoo-klay');
  const game = bazooGame();
  fire(game);
  assert.equal(game.shots.length, 0, 'no ball of dirt');
  const w = game.waves[0];
  assert.ok(w, 'a wave');
  assert.ok(Math.abs(w.range - SHOT.range * 0.63) < 1e-9);
  assert.ok(Math.abs(w.speed - SHOT.speed * 0.85) < 1e-9);
  const k = game.klay;
  const inside = game.addBacteria(k.x + 120, k.y + Math.tan((18 * Math.PI) / 180) * 120);
  const outside = game.addBacteria(k.x + 120, k.y + Math.tan((30 * Math.PI) / 180) * 120);
  const beyond = game.addBacteria(k.x + SHOT.range * 0.63 + 40, k.y);
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

// ---------------------------------------------------------------- v28

test('orange (v28, was yellow): it spits from twice as far, and its germ flies twice as far, 50% faster', () => {
  assert.equal(KINDS.orange.reach, 20 * UNIT);
  assert.equal(KINDS.orange.germ.speed, 225);
  assert.equal(KINDS.orange.germ.range, 10 * UNIT * 1.6 * 2);
  assert.ok(KINDS.orange.germ.range > KINDS.orange.reach, 'it can reach him from where it stops');
  const game = quietGame();
  const k = game.klay;
  game.addBacteria(k.x + 110, k.y, 'orange');
  game.drainEvents();
  run(game, 1.8);
  assert.ok(game.drainEvents().some((e) => e.type === 'poison' && e.kind === 'orange'), 'hit from 110 away');
});

test('bazoo-klay (v28): it shoots half as often as a throw', () => {
  const shots = (tools) => {
    const game = quietGame({ tools });
    game.klay.x = SOIL.cx - 300; game.klay.y = SOIL.cy + 150;
    game.klay.lookAlong({ x: 1, y: 0 });
    let n = 0;
    for (let t = 0; t < 3; t += STEP) {
      game.update(STEP, { ...NO_INPUT, held: true });
      n += game.drainEvents().filter((e) => e.type === 'throw' || e.type === 'blast').length;
    }
    return n;
  };
  const plain = shots([]);
  const bazoo = shots(['bazoo']);
  assert.ok(Math.abs(bazoo / plain - 0.5) < 0.1, `${bazoo} against ${plain}`);
});

test('blue (v29): one bit of dirt at a time, the nearest', () => {
  const game = quietGame();
  game.klay.x = SOIL.cx + 260; game.klay.y = SOIL.cy;
  const b = game.addBacteria(SOIL.cx - 150, SOIL.cy - 100, 'blue');
  b.speed = 0;
  const near = game.addBacteria(b.x + 60, b.y);
  const far = game.addBacteria(b.x - 120, b.y + 30);
  for (const o of [near, far]) { o.speed = 0; o.decayTime = Infinity; o.addDirt(2); }
  b.cooldown = 0;
  run(game, KINDS.blue.land + 0.4);
  assert.equal(near.dirt, 1, 'the nearer one');
  assert.equal(far.dirt, 2, 'not both at once');
});

// ---------------------------------------------------------------- cactus (v29)

test('cactus (v29): 299K, up to 9 hearts, heals and grows like the mushroom, no spores', () => {
  const game = quietGame({ sprouts: ['cactus'] });
  assert.equal(game.gear.sprout, 'cactus');
  assert.equal(game.gear.spores, null, 'no spores');
  assert.equal(game.heartCap >= 9 || game.gear.maxLives === 9, true);
  assert.equal(game.gear.maxLives, 9);
  assert.deepEqual(game.gear.heal, { every: 30, amount: 0.5 });
  assert.equal(game.gear.growEvery, 50);
});

test('cactus: every 6 to 12 s a thorn at the nearest: a crawling bacteria dies; one in dirt, or a dirtball, breaks', () => {
  const game = quietGame({ sprouts: ['cactus'] });
  game.klay.x = SOIL.cx + 260; game.klay.y = SOIL.cy + 100;
  assert.ok(game.thornTimer >= 6 && game.thornTimer <= 12);
  const crawler = game.addBacteria(game.tree.x - 120, game.tree.y - 80);
  const dirty = game.addBacteria(game.tree.x + 150, game.tree.y - 60);
  const ball = game.addDirtball(game.tree.x - 60, game.tree.y + 200);
  ball.hold = Infinity;                      // it would crack open by itself otherwise
  for (const b of [crawler, dirty]) { b.speed = 0; b.decayTime = Infinity; }
  dirty.addDirt(2);
  game.drainEvents();
  const left = () => [crawler.alive, dirty.alive, ball.solid].filter(Boolean).length;
  run(game, 12.5);
  assert.ok(game.drainEvents().some((e) => e.type === 'thorn'), 'it shot');
  assert.equal(left(), 2, 'one at a time');
  assert.equal(crawler.alive, false, 'the nearest went first, on the spot');
  run(game, 12.5);
  assert.equal(left(), 1);
  run(game, 12.5);
  assert.equal(left(), 0, 'in dirt: broken; the dirtball too');
});

test('cactus: no orange or blue bacteria at all, not even from a boss', () => {
  const game = new Game({ rng: () => 0.5, loadout: { sprouts: ['cactus'] } });
  game.reset({ sprouts: ['cactus'] }, 35);
  const level = Array.from({ length: 80 }, () => game.nextKind());
  const boss = Array.from({ length: 40 }, () => game.nextBossKind());
  assert.ok([...level, ...boss].every((k) => k === 'green'));
  const plain = new Game({ rng: () => 0.5 });
  plain.reset(undefined, 35);
  assert.ok(Array.from({ length: 40 }, () => plain.nextBossKind()).some((k) => k !== 'green'), 'without it, they come');
});

// ---------------------------------------------------------------- radio and AI (v29)

test('radio (v29): for 5 seconds every bacteria does the opposite', () => {
  const game = quietGame({ gadgets: ['radio'] });
  const k = game.klay;
  k.x = SOIL.cx + 200; k.y = SOIL.cy + 120;
  const green = game.addBacteria(game.tree.x - 160, game.tree.y);
  const orange = game.addBacteria(k.x - 60, k.y - 60, 'orange');
  const dirty = game.addBacteria(SOIL.cx - 250, SOIL.cy + 150);
  dirty.speed = 0; dirty.decayTime = Infinity; dirty.addDirt(2);
  const blue = game.addBacteria(dirty.x + 100, dirty.y - 40, 'blue');
  for (const b of [green, orange, blue]) b.speed = 40;
  const before = [dist(green, game.tree), dist(orange, k), dist(blue, dirty)];
  assert.equal(game.useGadget(0), true);
  assert.equal(game.jammed, true);
  run(game, 2);
  const after = [dist(green, game.tree), dist(orange, k), dist(blue, dirty)];
  assert.ok(after[0] > before[0] + 30, 'green: away from the sprout');
  assert.ok(after[1] > before[1] + 30, 'orange: away from Klayman');
  assert.ok(after[2] > before[2] + 30, 'blue: away from the dirt');
  assert.equal(game.germs.length + game.zaps.length, 0, 'nothing spat, nothing shot');
  assert.equal(dirty.dirt, 2);
  run(game, 3.1);
  assert.equal(game.jammed, false, 'five seconds');
  assert.equal(GADGETS.radio.cooldown, 15);
});

test('AI (v29): it blinks up for 0.75 s, works 3.5 s, blinks out 0.75 s; plain dirt, 1.5 times as fast as Klayman now', () => {
  const game = quietGame({ gadgets: ['ai'], tools: ['gloves', 'gun', 'bazoo'] });
  const k = game.klay;
  k.x = SOIL.cx - 200; k.y = SOIL.cy + 150;
  const b = game.addBacteria(k.x + 120, k.y - 120);
  b.speed = 0; b.decayTime = Infinity;
  game.useGadget(0);
  assert.ok(game.ai, 'out');
  run(game, 0.7);
  assert.equal(game.shots.filter((s) => s.ai).length, 0, 'still blinking up');
  game.drainEvents();
  const times = [];
  for (let t = 0; t < 3.5; t += STEP) {
    game.update(STEP);
    for (const e of game.drainEvents()) if (e.type === 'throw' && e.ai) times.push(t);
  }
  assert.equal(times.length, 5, 'five throws of plain dirt: one layer each, whatever he wears');
  assert.equal(game.dirtballs.length, 1, 'and it’s a dirtball');
  assert.equal(game.waves.length, 0, 'none of his tools: no bazoo-klay waves from it');
  const gap = (times[4] - times[0]) / 4;
  const want = KLAYMAN.attackCooldown / (game.fireRate * GADGETS.ai.fireRate);
  assert.ok(Math.abs(gap - want) < 0.03, `a throw every ${gap.toFixed(3)} s, against ${want.toFixed(3)}`);
  run(game, 0.9);
  assert.equal(game.ai, null, 'gone after 5 s');
});

test('AI: it pushes the nearest dirtball into the nearest bacteria', () => {
  const game = quietGame({ gadgets: ['ai'] });
  const k = game.klay;
  k.x = SOIL.cx + 200; k.y = SOIL.cy + 150;
  const ball = game.addDirtball(k.x - 120, k.y - 40);
  ball.hold = Infinity;
  const prey = game.addBacteria(ball.x - 200, ball.y - 20);
  prey.speed = 0;
  game.useGadget(0);
  run(game, 4.4);
  assert.ok(ball.state === 'rolling' || ball.dead || !prey.alive, 'pushed');
});

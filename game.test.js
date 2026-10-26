// Run with:  npm test   (or: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { BACTERIA, DIRTBALL, ITEMS, KLAYMAN, LEVELS, LOOKAHEAD, POISON, SCORE, TREE } from './config.js';
import { Bacteria } from './bacteria.js';
import { itemChoices } from './items.js';
import { SOIL, TREE_SPOT, dist, insideSoil } from './world.js';

const STEP = 1 / 60;

function run(game, seconds, input = NO_INPUT) {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
}

/** A game with an empty pot, Klayman parked far from the action. */
function quietGame() {
  const game = new Game({ rng: () => 0.5 });
  game.phase = 'test';
  game.toSpawn = 0;
  game.klay.x = SOIL.cx - 120;
  game.klay.y = SOIL.cy + 80;
  return game;
}

test('four dirt hits make a dirtball, one look per layer', () => {
  const b = new Bacteria(0, 0);
  const looks = [];
  for (let i = 0; i < 3; i++) { assert.equal(b.addDirt(1), false); looks.push(b.look); }
  assert.deepEqual(looks, [1, 2, 3]);
  assert.equal(b.addDirt(1), true);
});

test('with the bag, three hits are enough', () => {
  const b = new Bacteria(0, 0);
  const hits = [1, 2, 3].map(() => b.addDirt(ITEMS.bagBoost));
  assert.deepEqual(hits, [false, false, true]);
});

test('dirt sheds one layer at a time, then the bacteria crawls again', () => {
  const b = new Bacteria(0, 0);
  b.addDirt(1); b.addDirt(1);
  const target = { x: 100, y: 0 };
  for (let t = 0; t < BACTERIA.decayTime + 0.05; t += STEP) b.update(STEP, target, false);
  assert.equal(b.dirt, 1);
  assert.equal(b.state, 'dirty');
  assert.equal(b.x, 0, 'a dirty bacteria does not move');
  for (let t = 0; t < BACTERIA.decayTime; t += STEP) b.update(STEP, target, false);
  assert.equal(b.state, 'crawl');
  b.update(0.5, target, false);
  assert.ok(b.x > 0, 'clean again, it crawls');
});

test('a dirtball holds for a while, then cracks into a very dirty bacteria', () => {
  const game = quietGame();
  game.addDirtball(TREE_SPOT.x - 100, TREE_SPOT.y - 60);
  run(game, DIRTBALL.holdTime - 0.1);
  assert.equal(game.dirtballs.length, 1);
  run(game, 0.2);
  assert.equal(game.dirtballs.length, 0);
  assert.equal(game.bacteria.length, 1);
  assert.equal(game.bacteria[0].dirt, BACTERIA.maxDirt - 1);
});

test('a rolling dirtball smashes the first bacteria it meets and breaks', () => {
  const game = quietGame();
  const row = TREE_SPOT.y + 100;
  const ball = game.addDirtball(TREE_SPOT.x - 200, row);
  const near = game.addBacteria(TREE_SPOT.x - 140, row);
  const far = game.addBacteria(TREE_SPOT.x - 80, row);
  near.addDirt(1); far.addDirt(1);
  ball.push({ x: 1, y: 0 });
  run(game, 0.4);
  assert.equal(near.state === 'breaking' || near.dead, true);
  assert.equal(far.alive, true, 'it does not roll through');
  assert.equal(game.score, SCORE.smash + SCORE.dirtball);
});

test('a healthy Klayman swallows a bacteria and turns green; then they pass him', () => {
  const game = quietGame();
  const k = game.klay;
  k.x = game.tree.x + 90; k.y = game.tree.y;   // standing between the bacteria and the sprout
  const first = game.addBacteria(game.tree.x + 130, game.tree.y);
  run(game, 2);
  assert.equal(k.poisoned, true);
  assert.equal(first.dead || first.state === 'absorbed', true);

  const second = game.addBacteria(k.x + 20, k.y);
  run(game, 0.3);
  assert.equal(second.crawling, true, 'he is green, so it crawls past');
});

test('poison: frozen 0.2s, then half speed for 2s', () => {
  const game = quietGame();
  const k = game.klay;
  k.poison();
  const right = { x: 1, y: 0, pressed: false, held: false };
  const x0 = k.x;
  run(game, POISON.stun - STEP, right);
  assert.equal(k.x, x0, 'stunned');
  run(game, 0.5, right);
  const slowMoved = k.x - x0;
  assert.ok(slowMoved > 0 && slowMoved < 0.5 * 108 * 0.55, `slow: moved ${slowMoved}`);
  assert.equal(k.poison(), false, 'it does not stack');
});

test('a bacteria reaching the sprout costs a life; three ends the game', () => {
  const game = quietGame();
  for (let i = 0; i < TREE.lives; i++) {
    game.addBacteria(game.tree.x + 10, game.tree.y);
    run(game, 0.2);
  }
  assert.equal(game.lives, 0);
  assert.equal(game.over, true);
});

test('levels grow by two bacteria and clear when the pot is empty', () => {
  const game = new Game({ rng: () => 0.5 });
  assert.equal(game.levelSize(1), 5);
  assert.equal(game.levelSize(2), 7);
  game.phase = 'play';
  game.toSpawn = 0;
  run(game, 2);
  assert.equal(game.level, 2);
});

test('from level 3, an item appears near the sprout every 60s and waits 20s', () => {
  const game = quietGame();
  run(game, ITEMS.every + 1);
  assert.equal(game.item, null, 'locked before level 3');

  game.startLevel(3);
  game.phase = 'test';
  game.toSpawn = 0;
  run(game, ITEMS.every - 1);
  assert.equal(game.item, null);
  run(game, 1.1);
  assert.ok(game.item, 'an item appeared');
  const d = dist(game.item, game.tree);
  assert.ok(d >= ITEMS.nearSprout.min && d <= ITEMS.nearSprout.max, `near the sprout (${d})`);
  assert.ok(insideSoil(game.item.x, game.item.y), 'on the soil');
  run(game, ITEMS.lifetime - 1);
  assert.ok(game.item, 'still waiting after 19s');
  run(game, 1.1);
  assert.equal(game.item, null, 'gone if nobody picks it up');
});

test('auto throw keeps throwing, and pushes a dirtball he walks into', () => {
  const game = quietGame();
  const k = game.klay;
  k.facing = 'side'; k.flip = false;
  const auto = { x: 0, y: 0, pressed: false, held: false, auto: true };
  game.drainEvents();
  run(game, 1, auto);
  const throws = game.drainEvents().filter((e) => e.type === 'throw').length;
  assert.ok(throws >= 3, `threw ${throws} times`);

  const ball = game.addDirtball(k.x + 60, k.y);
  run(game, 0.3, auto);
  assert.equal(ball.state, 'idle', 'not touching yet: no push');
  run(game, 0.6, { ...auto, x: 1 });
  assert.notEqual(ball.state, 'idle', 'walked into it: auto push');
});

test('a push needs Klayman right up against the dirtball', () => {
  const tap = { x: 0, y: 0, pressed: true, held: false, auto: false };
  const tryPush = (gap, side = 0) => {
    const game = quietGame();
    const k = game.klay;
    k.facing = 'side'; k.flip = false;
    const ball = game.addDirtball(k.x + gap, k.y + side);
    game.update(STEP, tap);
    return ball.state === 'rolling';
  };
  const touching = KLAYMAN.radius + DIRTBALL.radius;
  assert.equal(tryPush(touching), true, 'touching');
  assert.equal(tryPush(touching + KLAYMAN.pushGap), true, 'a hair away');
  assert.equal(tryPush(touching + 12), false, 'a step away');
  assert.equal(tryPush(45), false, 'the old reach no longer counts');
  assert.equal(tryPush(14, 22), false, 'off to the side');
  assert.equal(tryPush(-touching), false, 'behind him');
});

test('keys: Space throws, never pushes; K pushes, never throws', () => {
  const setUp = () => {
    const game = quietGame();
    const k = game.klay;
    k.facing = 'side'; k.flip = false;
    game.drainEvents();
    return { game, k };
  };
  let { game, k } = setUp();
  let ball = game.addDirtball(k.x + 28, k.y);
  game.update(STEP, { ...NO_INPUT, throwPressed: true });
  assert.equal(ball.state, 'idle', 'Space next to a dirtball still throws');
  assert.ok(game.drainEvents().some((e) => e.type === 'throw'));

  ({ game, k } = setUp());
  ball = game.addDirtball(k.x + 28, k.y);
  game.update(STEP, { ...NO_INPUT, pushPressed: true });
  assert.equal(ball.state, 'rolling', 'K pushes');

  ({ game, k } = setUp());
  game.update(STEP, { ...NO_INPUT, pushPressed: true });
  run(game, 0.5);
  assert.equal(game.drainEvents().filter((e) => e.type === 'throw').length, 0, 'K with nothing to push does nothing');
});

test('level 7 skill: dirt from afar breaks a dirtball; up close it still pushes', () => {
  const tap = { x: 0, y: 0, pressed: true, held: false, auto: false };
  const setUp = (level, gap) => {
    const game = quietGame();
    game.level = level;
    const k = game.klay;
    k.facing = 'side'; k.flip = false;
    return { game, ball: game.addDirtball(k.x + gap, k.y) };
  };

  let { game, ball } = setUp(6, 120);
  game.update(STEP, tap);
  run(game, 0.5);
  assert.equal(ball.state, 'idle', 'before level 7, dirt flies past');

  ({ game, ball } = setUp(7, 120));
  game.update(STEP, tap);
  run(game, 0.5);
  assert.equal(ball.state === 'breaking' || ball.dead, true, 'from afar, it breaks');
  assert.equal(game.score, SCORE.dirtball);

  ({ game, ball } = setUp(7, 28));
  game.update(STEP, tap);
  assert.equal(ball.state, 'rolling', 'up close, it is pushed');
});

test('the phone button pushes a dirtball he touches, and throws otherwise', () => {
  const game = quietGame();
  const k = game.klay;
  k.facing = 'side'; k.flip = false;
  const ball = game.addDirtball(k.x + 60, k.y);
  game.drainEvents();
  game.update(STEP, { ...NO_INPUT, pressed: true });
  assert.equal(ball.state, 'idle');
  assert.ok(game.drainEvents().some((e) => e.type === 'throw'), 'not touching: a throw');
  run(game, 0.4);
  ball.x = k.x + 27;
  game.update(STEP, { ...NO_INPUT, pressed: true });
  assert.equal(ball.state, 'rolling', 'touching: a push');
});

test('bacteria are 5% faster and every level spawns 10% more often', () => {
  assert.equal(BACTERIA.speed, 16 * 1.05);
  const game = new Game({ rng: () => 0.5 });
  for (const n of [1, 4, 12]) {
    const before = Math.max(LEVELS.minSpawnEvery, LEVELS.spawnEvery - LEVELS.spawnEveryStep * (n - 1));
    assert.ok(Math.abs(game.spawnEveryFor(n) - before / 1.1) < 1e-9, `level ${n}`);
  }
});

test('bacteria left counts the ones to come, the ones out, and the ones in dirtballs', () => {
  const game = quietGame();
  game.toSpawn = 3;
  game.addBacteria(TREE_SPOT.x - 150, TREE_SPOT.y);
  game.addDirtball(TREE_SPOT.x + 150, TREE_SPOT.y);
  assert.equal(game.bacteriaLeft, 5);
  game.breakDirtball(game.dirtballs[0]);
  assert.equal(game.bacteriaLeft, 4, 'a breaking dirtball no longer counts');
});

test('the glasses know every bacteria due in the next 3 seconds, and each appears right there', () => {
  const game = new Game({ rng: () => 0.3 });
  game.klay.x = SOIL.cx - 300;                   // away from the rim spot
  game.update(STEP);
  // Level 1: the first is 2.2s off (banner, then 0.4s), the second 1.36s after.
  assert.equal(LOOKAHEAD, 3);
  assert.equal(game.upcoming.length, 1, 'only the first is within 3s');
  run(game, 0.6);
  assert.equal(game.upcoming.length, 2, 'now the second is too');
  for (let i = 0; i < game.upcoming.length; i++) assert.ok(game.untilUpcoming(i) <= LOOKAHEAD);
  const planned = [...game.upcoming];
  game.drainEvents();
  run(game, 3);
  const spawns = game.drainEvents().filter((e) => e.type === 'spawn').map((e) => ({ x: e.x, y: e.y }));
  assert.deepEqual(spawns.slice(0, 2), planned);
});

test('nothing is planned past the end of the level', () => {
  const game = new Game({ rng: () => 0.3 });
  game.toSpawn = 1;
  run(game, 0.6);
  assert.equal(game.upcoming.length, 1);
});

test('the next special item is placed 3 seconds early, and lands right there', () => {
  const game = quietGame();
  game.startLevel(ITEMS.unlockLevel);
  game.phase = 'test';
  game.toSpawn = 0;
  game.itemTimer = 3.5;
  run(game, 0.4);
  assert.equal(game.nextItem, null);
  run(game, 0.2);
  const planned = game.nextItem;
  assert.ok(planned);
  run(game, 3);
  assert.ok(game.item);
  assert.deepEqual({ x: game.item.x, y: game.item.y }, planned);
});

test('red plus never shows up when the sprout is full', () => {
  assert.equal(itemChoices(3, 3).includes('plus'), false);
  assert.equal(itemChoices(2, 3).includes('plus'), true);
  assert.equal(itemChoices(TREE.maxLives, TREE.maxLives).includes('water'), false);
});

test('items do what they say', () => {
  const game = quietGame();
  game.lives = 2;
  game.useItem({ type: 'plus', x: 0, y: 0 });
  assert.equal(game.lives, 3);

  game.useItem({ type: 'water', x: 0, y: 0 });
  assert.equal(game.maxLives, 4);
  assert.equal(game.lives, 4);
  assert.ok(game.treeScale > 1);
  for (let i = 0; i < 5; i++) game.useItem({ type: 'water', x: 0, y: 0 });
  assert.equal(game.maxLives, TREE.maxLives, 'capped at 7');

  game.useItem({ type: 'bag', x: 0, y: 0 });
  assert.equal(game.boostFactor, ITEMS.bagBoost);
  run(game, ITEMS.bagTime + 0.1);
  assert.equal(game.boostFactor, 1);

  const b = game.addBacteria(game.tree.x + 150, game.tree.y);
  game.useItem({ type: 'sandclock', x: 0, y: 0 });
  const x0 = b.x;
  run(game, ITEMS.sandclockTime - 0.1);
  assert.equal(b.x, x0, 'frozen');
  run(game, 0.5);
  assert.ok(b.x < x0, 'moving again');
});

test('walking onto an item picks it up', () => {
  const game = quietGame();
  game.startLevel(3);
  game.phase = 'test';
  game.toSpawn = 0;
  game.itemTimer = 0.01;
  run(game, 0.05);
  const item = game.item;
  game.klay.x = item.x;
  game.klay.y = item.y + 5;
  run(game, STEP * 2);
  assert.equal(game.item, null);
  assert.ok(game.drainEvents().some((e) => e.type === 'pickup'));
});

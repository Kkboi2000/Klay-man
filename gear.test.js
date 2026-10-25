// Tools, sprouts, coins and the shop. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { COINS, KLAYMAN, SHOT, SPROUTS, TOOLS, TREE, ITEMS } from './config.js';
import { Wallet, gearFor, formatK } from './gear.js';
import { SOIL, TREE_SPOT, dist, insideSoil } from './world.js';

const STEP = 1 / 60;
const run = (game, seconds, input = NO_INPUT) => {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
};
const tap = { x: 0, y: 0, pressed: true, held: false, auto: false };
const right = { x: 1, y: 0, pressed: false, held: false, auto: false };

/** An empty pot: no spawning, Klayman parked away from the sprout. */
function quietGame(loadout, rng = () => 0.5) {
  const game = new Game({ rng, loadout });
  game.phase = 'test';
  game.toSpawn = 0;
  game.klay.x = SOIL.cx - 120;
  game.klay.y = SOIL.cy + 80;
  game.coinTimer = Infinity;              // coins only where a test wants them
  return game;
}

/** A fake storage, so wallet tests never touch the real one. */
function memory() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
}

// ------------------------------------------------------------------ coins

test('a 1K coin turns up on the soil every 27 seconds and lasts 15', () => {
  const game = quietGame();
  game.coinTimer = COINS.every;
  run(game, COINS.every - 0.1);
  assert.equal(game.coins.length, 0);
  run(game, 0.2);
  assert.equal(game.coins.length, 1);
  const coin = game.coins[0];
  assert.equal(coin.value, 1);
  assert.ok(insideSoil(coin.x, coin.y), 'on the soil');
  run(game, COINS.lifetime - 0.3);
  assert.equal(game.coins.length, 1, 'still there');
  run(game, 0.4);
  assert.equal(game.coins.length, 0, 'gone after 15 seconds');
  assert.equal(COINS.every, 27);
  assert.equal(COINS.lifetime, 15);
});

test('walking onto a coin picks it up', () => {
  const game = quietGame();
  game.dropCoin({ x: game.klay.x + 60, y: game.klay.y }, 1);
  game.drainEvents();
  run(game, 1, right);
  assert.equal(game.coins.length, 0);
  assert.equal(game.earned, 1);
  assert.ok(game.drainEvents().some((e) => e.type === 'coin' && e.value === 1));
});

test('a kill drops a 5K coin 5% of the time, and it lasts 15 seconds too', () => {
  const kill = (roll) => {
    const game = quietGame(undefined, () => roll);
    const ball = game.addDirtball(TREE_SPOT.x - 150, TREE_SPOT.y - 40);
    game.breakDirtball(ball);
    return game.coins;
  };
  assert.equal(COINS.dropChance, 0.05);
  assert.equal(kill(0.06).length, 0, 'a 0.06 roll: no coin');
  const coins = kill(0.04);
  assert.equal(coins.length, 1, 'a 0.04 roll: a coin');
  assert.equal(coins[0].value, COINS.dropValue);
  assert.equal(coins[0].life, COINS.lifetime);
});

test('a smash is two kills: the bacteria hit and the one inside the ball', () => {
  const game = quietGame(undefined, () => 0.01);
  const row = TREE_SPOT.y + 100;
  const ball = game.addDirtball(TREE_SPOT.x - 200, row);
  game.addBacteria(TREE_SPOT.x - 140, row).addDirt(1);
  ball.push({ x: 1, y: 0 });
  run(game, 0.4);
  assert.equal(game.coins.length, 2);
});

// ------------------------------------------------------------------ tools

test('shoes: 10% faster, and Klayman walks through the sprout', () => {
  const walk = (tool) => {
    const game = quietGame({ tool });
    const x0 = game.klay.x;
    run(game, 0.5, right);
    return game.klay.x - x0;
  };
  const plain = walk(null);
  assert.ok(Math.abs(walk('shoes') / plain - TOOLS.shoes.speed) < 0.02);

  const through = (tool) => {
    const game = quietGame({ tool });
    game.klay.x = game.tree.x - 30;
    game.klay.y = game.tree.y;
    run(game, 0.6, right);
    return game.klay.x > game.tree.x + 10;
  };
  assert.equal(through(null), false, 'the sprout blocks bare feet');
  assert.equal(through('shoes'), true, 'shoes walk through it');
});

test('gloves: 10% more throws, 10% farther', () => {
  const throws = (tool) => {
    const game = quietGame({ tool });
    game.drainEvents();
    run(game, 30, { ...NO_INPUT, auto: true });
    return game.drainEvents().filter((e) => e.type === 'throw').length;
  };
  // Throws land on whole 1/60s steps, so the ratio is close to, not exactly, 1.1.
  const ratio = throws('gloves') / throws(null);
  assert.ok(ratio > 1.07 && ratio < 1.15, `ratio ${ratio}`);
  assert.equal(quietGame({ tool: 'gloves' }).shotRange, SHOT.range * TOOLS.gloves.range);
});

test('lab coat: bacteria crawl past without getting into Klayman', () => {
  const game = quietGame({ tool: 'coat' });
  const k = game.klay;
  k.x = game.tree.x + 90; k.y = game.tree.y;
  game.addBacteria(game.tree.x + 130, game.tree.y);
  run(game, 2);
  assert.equal(k.poisoned, false);
});

test('dirt gun: locks on to a bacteria behind Klayman and hits it', () => {
  const game = quietGame({ tool: 'gun' });
  const k = game.klay;
  k.facing = 'side'; k.flip = false;               // facing right...
  const b = game.addBacteria(k.x - 150, k.y);       // ...bacteria on the left
  game.drainEvents();
  game.update(STEP, tap);
  assert.equal(k.facing, 'side');
  assert.equal(k.flip, true, 'standing still, he turns to it');
  run(game, 0.6);
  assert.ok(b.dirt >= 1 || !b.alive, 'the shot landed');
  assert.ok(game.drainEvents().some((e) => e.type === 'hit'));
});

test('dirt gun: locks on to the closest bacteria and faces it, walking or standing', () => {
  const game = quietGame({ tool: 'gun' });
  const k = game.klay;
  const far = game.addBacteria(k.x + 200, k.y);
  const near = game.addBacteria(k.x + 40, k.y - 140);  // closer, and above him
  game.update(STEP);
  assert.equal(game.lock, near, 'the closest one');
  assert.equal(k.facing, 'back', 'standing, he faces it');
  game.update(STEP, { ...right, pressed: true });
  assert.equal(game.lock, near);
  assert.equal(k.facing, 'back', 'walking right, he still faces it');
  run(game, 0.6, right);
  assert.ok(near.dirt >= 1 || !near.alive, 'the shot landed');
  assert.equal(far.dirt, 0, 'and not on the other one');
});

test('dirt gun: no lock without a bacteria in reach; he faces where he walks', () => {
  const game = quietGame({ tool: 'gun' });
  const k = game.klay;
  game.addBacteria(k.x + game.shotRange + 60, k.y);
  run(game, 0.2, { ...NO_INPUT, y: 1 });
  assert.equal(game.lock, null);
  assert.equal(k.facing, 'front');
});

test('dirt gun: walking up to a dirtball and tapping still pushes it', () => {
  const game = quietGame({ tool: 'gun' });
  const k = game.klay;
  game.addBacteria(k.x, k.y - 150);                  // locked, above him
  const ball = game.addDirtball(k.x + 60, k.y);
  run(game, 0.3, right);                               // walk right, up to the ball
  assert.equal(k.facing, 'back', 'aiming at the bacteria');
  game.update(STEP, { ...right, pressed: true });
  assert.equal(ball.state, 'rolling');
  assert.ok(ball.vx > 0, 'rolled the way he walked');
});

test('dirt gun: 20% faster and 20% farther than bare hands', () => {
  const g = gearFor({ tool: 'gun' });
  assert.equal(g.fireRate, 1.2);
  assert.equal(quietGame({ tool: 'gun' }).shotRange, SHOT.range * 1.2);
});

// ---------------------------------------------------------------- sprouts

test('sunflower: special items every 20 seconds', () => {
  const game = quietGame({ sprout: 'sunflower' });
  game.startLevel(ITEMS.unlockLevel);
  game.phase = 'test';
  game.toSpawn = 0;
  run(game, 19.5);
  assert.equal(game.item, null);
  run(game, 0.6);
  assert.ok(game.item);
});

test('corn: starts with 6 hearts', () => {
  const game = new Game({ loadout: { sprout: 'corn' } });
  assert.equal(game.lives, 6);
  assert.equal(game.maxLives, 6);
  assert.equal(game.treeScale, 1, 'not drawn oversized');
});

test('rose: heals 1 heart every 30 seconds, never past full', () => {
  const game = quietGame({ sprout: 'rose' });
  game.lives = 1;
  run(game, 29.9);
  assert.equal(game.lives, 1);
  run(game, 0.2);
  assert.equal(game.lives, 2);
  run(game, 60);
  assert.equal(game.lives, TREE.lives, 'full, and stays full');
});

test('mushroom: every 40s, crawling bacteria are pushed away and slowed; dirty ones are not', () => {
  const game = quietGame({ sprout: 'mushroom' });
  game.pulseTimer = 0.01;
  const crawler = game.addBacteria(game.tree.x + 100, game.tree.y);
  const dirty = game.addBacteria(game.tree.x - 100, game.tree.y);
  dirty.addDirt(1);
  const ball = game.addDirtball(game.tree.x, game.tree.y - 100);
  const before = { crawler: dist(crawler, game.tree), dirty: { x: dirty.x, y: dirty.y }, ball: { x: ball.x, y: ball.y } };
  run(game, 0.5);
  assert.ok(dist(crawler, game.tree) > before.crawler + SPROUTS.mushroom.push * 0.8, 'pushed away');
  assert.equal(crawler.slowed, true);
  assert.deepEqual({ x: dirty.x, y: dirty.y }, before.dirty, 'a dirty one stays');
  assert.equal(dirty.slowed, false);
  assert.deepEqual({ x: ball.x, y: ball.y }, before.ball, 'a dirtball stays');

  // Slowed: half speed for 4 seconds, then normal.
  const crawl = (secs) => { const d0 = dist(crawler, game.tree); run(game, secs); return d0 - dist(crawler, game.tree); };
  const slow = crawl(1);
  run(game, SPROUTS.mushroom.slowTime);
  const normal = crawl(1);
  assert.ok(Math.abs(slow / normal - SPROUTS.mushroom.slowFactor) < 0.1, `slow ${slow} vs ${normal}`);
});

test('mushroom: grows 1 heart every 80 seconds, up to 9', () => {
  const game = quietGame({ sprout: 'mushroom' });
  game.pulseTimer = Infinity;
  run(game, 79.9);
  assert.equal(game.maxLives, 3);
  run(game, 0.2);
  assert.equal(game.maxLives, 4);
  assert.equal(game.lives, 4);
  assert.ok(game.treeScale > 1, 'and gets bigger');
  run(game, 80 * 6);
  assert.equal(game.maxLives, 9, 'stops at 9');
});

test('water drops grow a mushroom to 9 hearts, corn stays at 6, the rest stop at 7', () => {
  for (const [sprout, cap] of [['sprout', 7], ['sunflower', 7], ['rose', 7], ['corn', 6], ['mushroom', 9]]) {
    const game = quietGame({ sprout });
    for (let i = 0; i < 10; i++) game.useItem({ type: 'water', x: 0, y: 0 });
    assert.equal(game.maxLives, cap, sprout);
  }
});

// ------------------------------------------------------------------- shop

test('the wallet buys once, keeps what you own, and saves', () => {
  const storage = memory();
  const w = new Wallet(storage);
  assert.equal(w.buy('shoes'), false, 'no coins yet');
  w.add(30);
  assert.equal(w.buy('shoes'), true);
  assert.equal(w.coins, 1);
  assert.equal(w.tool, 'shoes', 'bought means equipped');
  assert.equal(w.buy('shoes'), false, 'never bought twice');

  const again = new Wallet(storage);
  assert.equal(again.coins, 1);
  assert.equal(again.owns('shoes'), true);
  assert.equal(again.tool, 'shoes');
});

test('one tool at a time; you can only use what you own', () => {
  const w = new Wallet(memory());
  w.add(1000);
  w.buy('shoes');
  w.buy('gun');
  assert.equal(w.tool, 'gun');
  assert.equal(w.equip('shoes'), true);
  assert.equal(w.tool, 'shoes');
  assert.equal(w.equip('coat'), false, 'not bought');
  assert.equal(w.tool, 'shoes');
  w.equip(null);
  assert.equal(w.tool, null, 'bare hands');
  w.buy('rose');
  assert.deepEqual(w.loadout, { tool: null, sprout: 'rose' });
});

test('a broken or tampered save falls back safely', () => {
  const storage = memory();
  storage.setItem('klayman.wallet', '{"coins":-5,"owned":["laser"],"tool":"gun","sprout":"corn"}');
  const w = new Wallet(storage);
  assert.equal(w.coins, 0);
  assert.equal(w.tool, null, 'gun was never bought');
  assert.equal(w.sprout, 'sprout');
  storage.setItem('klayman.wallet', 'not json');
  assert.equal(new Wallet(storage).coins, 0);
});

test('prices match the brief', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries({ ...TOOLS, ...SPROUTS }).map(([k, v]) => [k, v.price])),
    { shoes: 29, gloves: 29, coat: 49, gun: 99, sprout: 0, sunflower: 149, corn: 199, rose: 249, mushroom: 299 },
  );
  assert.equal(formatK(1250), '1,250K');
});

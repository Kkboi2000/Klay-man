// Tools, sprouts, slots, one-use items, coins and the shop. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { BACTERIA, COINS, GADGETS, ITEMS, ONCE, REVIVE, SHOT, SLOTS, SPROUTS, TOOLS, TREE } from './config.js';
import {
  Wallet, gearFor, formatK, SAVE, ADMIN_SAVE, TOOL_IDS, SPROUT_IDS, GADGET_IDS, SLOT_IDS, ONCE_IDS, SKIP_IDS, CATALOG,
} from './gear.js';
import { RING_SQUASH, SOIL, TREE_SPOT, dist, insideRing, insideSoil } from './world.js';

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
const wearing = (...tools) => ({ tools });
const planting = (...sprouts) => ({ sprouts });

/** A fake storage, so wallet tests never touch the real one. */
function memory() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
}

// ------------------------------------------------------------------ coins

test('a 1K coin turns up on the soil every 30 seconds and lasts 18', () => {
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
  assert.equal(game.coins.length, 0, 'gone after 18 seconds');
  assert.equal(COINS.every, 30, '10% fewer than every 27s');
  assert.equal(COINS.lifetime, 18, '20% longer than 15s');
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

test('a kill drops a 5K coin 4.5% of the time, and it lasts 18 seconds too', () => {
  const kill = (roll) => {
    const game = quietGame(undefined, () => roll);
    const ball = game.addDirtball(TREE_SPOT.x - 150, TREE_SPOT.y - 40);
    game.breakDirtball(ball);
    return game.coins;
  };
  assert.equal(COINS.dropChance, 0.045);
  assert.equal(kill(0.046).length, 0, 'a 0.046 roll: no coin');
  const coins = kill(0.044);
  assert.equal(coins.length, 1, 'a 0.044 roll: a coin');
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

test('shoes: 15% faster, and Klayman walks through the sprout', () => {
  const walk = (tools) => {
    const game = quietGame({ tools });
    const x0 = game.klay.x;
    run(game, 0.5, right);
    return game.klay.x - x0;
  };
  const plain = walk([]);
  assert.ok(Math.abs(walk(['shoes']) / plain - 1.15) < 0.02);

  const through = (tools) => {
    const game = quietGame({ tools });
    game.klay.x = game.tree.x - 30;
    game.klay.y = game.tree.y;
    run(game, 0.6, right);
    return game.klay.x > game.tree.x + 10;
  };
  assert.equal(through([]), false, 'the sprout blocks bare feet');
  assert.equal(through(['shoes']), true, 'shoes walk through it');
});

test('gloves: 15% more throws, 15% farther', () => {
  const throws = (tools) => {
    const game = quietGame({ tools });
    game.drainEvents();
    run(game, 30, { ...NO_INPUT, auto: true });
    return game.drainEvents().filter((e) => e.type === 'throw').length;
  };
  // Throws land on whole 1/60s steps, so the ratio is close to, not exactly, 1.15.
  const ratio = throws(['gloves']) / throws([]);
  assert.ok(ratio > 1.11 && ratio < 1.2, `ratio ${ratio}`);
  assert.equal(quietGame(wearing('gloves')).shotRange, SHOT.range * 1.15);
});

test('coat: bacteria can’t get in, and one that touches him slows 30% for 5 seconds', () => {
  const game = quietGame(wearing('coat'));
  const k = game.klay;
  k.x = game.tree.x + 90; k.y = game.tree.y;
  const b = game.addBacteria(game.tree.x + 130, game.tree.y);
  game.drainEvents();
  run(game, 1.2);
  assert.equal(k.poisoned, false);
  assert.equal(b.slowed, true);
  assert.equal(b.slowFactor, 0.7);
  assert.ok(game.drainEvents().some((e) => e.type === 'slowed'));
  b.x = game.tree.x - 160; b.y = game.tree.y;   // away from him now
  run(game, 4.6);
  assert.equal(b.slowed, true, 'still slow after 4.6s');
  run(game, 0.6);
  assert.equal(b.slowed, false, 'normal after 5s');
});

test('glasses: they only tell the renderer to show more; the rules stay the same', () => {
  const g = gearFor(wearing('glasses'));
  assert.equal(g.glasses, true);
  assert.equal(g.speed, 1);
  assert.equal(g.fireRate, 1);
  assert.equal(gearFor().glasses, false);
});

test('dirt gun: locks on to a bacteria behind Klayman and hits it', () => {
  const game = quietGame(wearing('gun'));
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
  const game = quietGame(wearing('gun'));
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
  const game = quietGame(wearing('gun'));
  const k = game.klay;
  game.addBacteria(k.x + game.shotRange + 60, k.y);
  run(game, 0.2, { ...NO_INPUT, y: 1 });
  assert.equal(game.lock, null);
  assert.equal(k.facing, 'front');
});

test('dirt gun: walking into a dirtball and tapping still pushes it', () => {
  const game = quietGame(wearing('gun'));
  const k = game.klay;
  game.addBacteria(k.x, k.y - 150);                  // locked, above him
  const ball = game.addDirtball(k.x + 60, k.y);
  run(game, 0.4, right);                               // walk right, into the ball
  assert.equal(k.facing, 'back', 'aiming at the bacteria');
  game.update(STEP, { ...right, pressed: true });
  assert.equal(ball.state, 'rolling');
  assert.ok(ball.vx > 0, 'rolled the way he walked');
});

test('dirt gun: 5% faster throws, range and walking', () => {
  const g = gearFor(wearing('gun'));
  assert.equal(g.fireRate, 1.05);
  assert.equal(g.speed, 1.05);
  assert.equal(quietGame(wearing('gun')).shotRange, SHOT.range * 1.05);
});

test('two tools at once: their boosts multiply, and both powers work', () => {
  const g = gearFor(wearing('shoes', 'gun'));
  assert.ok(Math.abs(g.speed - 1.15 * 1.05) < 1e-9);
  assert.equal(g.lockOn, true);
  assert.equal(g.passSprout, true);
  assert.deepEqual(gearFor(wearing('coat', 'coat', 'laser')).tools, ['coat'], 'no doubles, nothing made up');
});

// ---------------------------------------------------------------- sprouts

test('sunflower: from level 1, every 30 seconds a glowing item pops out of the flower and lands near it', () => {
  const game = quietGame(planting('sunflower'));
  assert.equal(game.level, 1);
  game.drainEvents();
  run(game, 29.5);
  assert.equal(game.items.length, 0);
  run(game, 0.6);
  const [item] = game.items;
  assert.ok(item);
  assert.equal(item.glowing, true);
  const pop = game.drainEvents().find((e) => e.type === 'itemAppears');
  assert.deepEqual(pop.from, game.flowerTop, 'out of the flower');
  const d = dist(item, game.tree);
  assert.ok(d >= SPROUTS.sunflower.drop.min && d <= SPROUTS.sunflower.drop.max, `landed ${d} away`);

  // It can't be caught in the air.
  game.klay.x = item.x; game.klay.y = item.y;
  game.update(STEP);
  assert.deepEqual(game.items, [item], 'still flying');
  run(game, 0.7);
  assert.equal(game.items.length, 0, 'picked up once it landed');
});

test('rose: starts with 4 hearts and heals 1 every 20 seconds', () => {
  const game = quietGame(planting('rose'));
  assert.equal(game.lives, 4);
  game.lives = 1;
  run(game, 19.9);
  assert.equal(game.lives, 1);
  run(game, 0.2);
  assert.equal(game.lives, 2);
  run(game, 60);
  assert.equal(game.lives, 4, 'full, and stays full');
});

test('corn: 6 hearts, grows to 11, and its leaves keep bacteria out for 15 of every 40 seconds', () => {
  const fresh = new Game({ loadout: planting('corn') });
  assert.equal(fresh.lives, 6);
  assert.equal(fresh.treeScale, 1, 'not drawn oversized');

  const game = quietGame(planting('corn'));
  for (let i = 0; i < 10; i++) game.useItem({ type: 'water', x: 0, y: 0 });
  assert.equal(game.maxLives, 11);

  game.lives = 6;
  game.shieldTimer = 0.01;
  game.drainEvents();
  run(game, 0.05);
  assert.ok(game.shield > 14.9, 'leaves closed');
  assert.ok(game.drainEvents().some((e) => e.type === 'shield'));
  const b = game.addBacteria(game.tree.x + 60, game.tree.y);
  run(game, 14);
  assert.equal(game.lives, 6, 'nothing got in');
  assert.equal(b.crawling, true, 'it waits at the leaves');
  assert.ok(dist(b, game.tree) < 40);
  game.drainEvents();
  run(game, 1.5);
  assert.ok(game.drainEvents().some((e) => e.type === 'unshield'), 'it says when the leaves open');
  assert.equal(game.lives, 5, 'leaves open: it gets in');
  assert.ok(Math.abs(game.shieldTimer - (40 - 15.55)) < 0.1, 'next time 40 seconds after the last');
});

test('lilies: closed for 15 of every 40 seconds; bacteria wander and keep away', () => {
  const game = quietGame(planting('lilies'));
  assert.equal(game.lives, TREE.lives);
  assert.deepEqual(SPROUTS.lilies.hide, { every: 40, time: 15 });
  game.hideTimer = 0.01;
  run(game, 0.05);
  assert.ok(game.hidden > 14.9);
  const b = game.addBacteria(game.tree.x + 70, game.tree.y + 10);
  let closest = Infinity;
  for (let t = 0; t < 14.5; t += STEP) {
    game.update(STEP);
    closest = Math.min(closest, dist(b, game.tree));
  }
  assert.equal(game.lives, TREE.lives, 'nothing got in');
  assert.ok(closest > 40, `kept away (closest ${closest.toFixed(0)})`);
  assert.ok(Math.abs(b.y - (game.tree.y + 10)) > 1, 'it moved around');
  run(game, 0.6);
  assert.equal(game.hidden, 0, 'open again');
  run(game, 12);
  assert.ok(game.lives < TREE.lives, 'it heads for the sprout again');
});

test('mushroom: every 25s, spores push bacteria and dirtballs inside the ring 60 back, and dirty bacteria up a layer', () => {
  const m = SPROUTS.mushroom.spores;
  assert.equal(m.push, 60);
  assert.ok(Math.abs(m.reach - 330 * 0.75) < 1, 'a ring 25% smaller than 330');
  const game = quietGame(planting('mushroom'));
  game.sporeTimer = 0.01;
  game.healTimer = Infinity;
  const t = game.tree;
  const near = game.addBacteria(t.x + 100, t.y);
  const out = game.addBacteria(t.x + m.reach + 30, t.y);
  const dirty = game.addBacteria(t.x - 100, t.y);
  dirty.addDirt(1);
  const deep = game.addBacteria(t.x, t.y + 70);
  deep.addDirt(BACTERIA.maxDirt - 1);               // one throw from a dirtball
  const ball = game.addDirtball(t.x - 60, t.y - 90);
  const before = { near: dist(near, t), out: dist(out, t), dirty: dist(dirty, t), ball: dist(ball, t) };
  run(game, 0.5);
  const pushed = dist(near, t) - before.near;
  assert.ok(pushed > 45 && pushed < 75, `pushed ${pushed.toFixed(0)}`);
  assert.equal(near.dirt, 1, 'a clean one gets its first layer');
  assert.equal(near.state, 'dirty');
  assert.equal(near.slowed, true, 'and crawls slowly when it’s clean again');
  assert.ok(dist(out, t) < before.out, 'outside the ring: not pushed');
  assert.equal(out.dirt, 0);
  assert.ok(dist(dirty, t) - before.dirty > 45, 'a dirty one is pushed too');
  assert.equal(dirty.dirt, 2, 'and gets a layer more');
  assert.equal(deep.dead, true, 'three layers deep: it becomes a dirtball');
  assert.equal(game.dirtballs.length, 2);
  assert.ok(dist(game.dirtballs[1], t) > 70 + 45, 'and that dirtball is pushed too');
  assert.ok(dist(ball, t) - before.ball > 45, 'dirtballs slide away');
  assert.equal(ball.state, 'idle', 'without rolling');
  assert.equal(insideRing({ x: game.tree.x, y: game.tree.y + m.reach * 0.7 }, game.tree, m.reach), false,
    'the ring is flattened like the pot');
});

test('mushroom: grows 1 heart every 50 seconds up to 9, and heals half a heart every 30', () => {
  const game = quietGame(planting('mushroom'));
  game.sporeTimer = Infinity;
  game.healTimer = Infinity;
  run(game, 49.9);
  assert.equal(game.maxLives, 3);
  run(game, 0.2);
  assert.equal(game.maxLives, 4);
  assert.equal(game.lives, 4);
  assert.ok(game.treeScale > 1, 'and gets bigger');
  run(game, 50 * 6);
  assert.equal(game.maxLives, 9, 'stops at 9');

  const healer = quietGame(planting('mushroom'));
  healer.sporeTimer = Infinity;
  healer.lives = 1;
  run(healer, 30.1);
  assert.equal(healer.lives, 1.5);
});

test('water drops: mushroom to 9, corn to 11, the rest to 7', () => {
  for (const [sprout, cap] of [['sprout', 7], ['sunflower', 7], ['rose', 7], ['lilies', 7], ['corn', 11], ['mushroom', 9]]) {
    const game = quietGame(planting(sprout));
    for (let i = 0; i < 12; i++) game.useItem({ type: 'water', x: 0, y: 0 });
    assert.equal(game.maxLives, cap, sprout);
  }
});

// ------------------------------------------- the sprout is lost: carry on

function lose(game) {
  while (!game.over) {
    game.addBacteria(game.tree.x + 10, game.tree.y);
    run(game, 0.2);
  }
}

test('revive: once a game, the sprout comes back with half the hearts it could hold', () => {
  for (const [stock, back] of [[5, 2.5], [3, 1.5], [7, 3.5]]) {
    const game = quietGame();
    game.maxLives = stock;
    game.lives = 1;
    lose(game);
    assert.equal(game.reviveHearts, back);
    const near = game.addBacteria(game.tree.x + 60, game.tree.y);
    game.drainEvents();
    assert.equal(game.revive(), true);
    assert.equal(game.over, false);
    assert.equal(game.lives, back);
    assert.ok(game.drainEvents().some((e) => e.type === 'revive'));
    run(game, 0.5);
    assert.ok(dist(near, game.tree) > 60 + REVIVE.push * 0.6, 'room cleared round it');
    lose(game);
    assert.equal(game.canRevive, false, 'not twice in one game');
    assert.equal(game.revive(), false);
  }
});

test('revive carries on the same game: same level, score and bacteria, the sprout that was just lost', () => {
  const game = quietGame({ tools: [], sprouts: ['rose', 'corn'] });
  game.startLevel(4);
  game.phase = 'play';
  game.score = 2300;
  lose(game);
  game.useBackup();                                   // the corn takes over...
  game.score += 400;
  const out = game.addBacteria(game.tree.x - 200, game.tree.y + 60);
  lose(game);                                         // ...and is lost too
  const left = game.toSpawn;
  assert.equal(game.revive(), true);
  assert.equal(game.gear.sprout, 'corn', 'the one just lost, not the first');
  assert.equal(game.lives, 3, 'half of its 6');
  assert.equal(game.level, 4);
  assert.equal(game.score, 2700);
  assert.equal(game.toSpawn, left, 'the level goes on where it stopped');
  assert.ok(game.bacteria.includes(out), 'bacteria still out there');
});

test('revive is paid for on the summary: 49K, if you have it', () => {
  const w = new Wallet(memory());
  w.add(60);
  assert.equal(w.pay(ONCE.revive.price), true);
  assert.equal(w.coins, 11);
  assert.equal(w.pay(ONCE.revive.price), false, 'not enough left');
  assert.equal(w.coins, 11);
});

test('a half heart left takes one more hit to lose', () => {
  const game = quietGame();
  game.lives = 1.5;
  game.addBacteria(game.tree.x + 10, game.tree.y);
  run(game, 0.2);
  assert.equal(game.lives, 0.5);
  assert.equal(game.over, false);
  lose(game);
  assert.equal(game.lives, 0);
});

test('backup sprout: when the first is lost, the second carries on with its own hearts', () => {
  const game = quietGame({ tools: [], sprouts: ['sprout', 'corn'] });
  game.score = 1200;
  game.level = 4;
  assert.equal(game.backupSprout, 'corn');
  lose(game);
  assert.equal(game.canRevive, false, 'with a backup to carry on with, no revive on offer');
  assert.equal(game.revive(), false);
  assert.equal(game.useBackup(), true);
  assert.equal(game.gear.sprout, 'corn');
  assert.equal(game.lives, 6);
  assert.equal(game.score, 1200, 'same game, same score');
  assert.equal(game.level, 4);
  assert.equal(game.backupSprout, null, 'only one backup');
  lose(game);
  assert.equal(game.useBackup(), false);
  assert.equal(game.canRevive, true, 'no backup left: now the revive is offered');
  assert.equal(game.revive(), true);
  assert.equal(game.lives, 3);
  lose(game);
  assert.equal(game.canRevive, false, 'and only once a game');
});

// ------------------------------------------------------------------- shop

test('the wallet buys once, keeps what you own, and saves', () => {
  const storage = memory();
  const w = new Wallet(storage);
  assert.equal(w.buy('shoes'), false, 'no coins yet');
  w.add(30);
  assert.equal(w.buy('shoes'), true);
  assert.equal(w.coins, 1);
  assert.deepEqual(w.tools, ['shoes'], 'bought means worn');
  assert.equal(w.buy('shoes'), false, 'never bought twice');

  const again = new Wallet(storage);
  assert.equal(again.coins, 1);
  assert.equal(again.owns('shoes'), true);
  assert.deepEqual(again.tools, ['shoes']);
});

test('one tool slot: picking a tool swaps it; you can only use what you own', () => {
  const w = new Wallet(memory());
  w.add(1000);
  w.buy('shoes');
  w.buy('gun');
  assert.deepEqual(w.tools, ['gun']);
  assert.equal(w.equip('shoes'), true);
  assert.deepEqual(w.tools, ['shoes']);
  w.equip('shoes');
  assert.deepEqual(w.tools, ['shoes'], 'tapping it again keeps it on');
  assert.equal(w.equip('coat'), false, 'not bought');
  w.equip(null);
  assert.deepEqual(w.tools, [], 'bare hands');
  w.buy('rose');
  assert.deepEqual(w.loadout, { tools: [], sprouts: ['rose'], gadgets: [] });
});

test('2nd tool slot: wear two; a third swaps out the oldest; tap one to take it off', () => {
  const w = new Wallet(memory());
  w.add(2000);
  for (const id of ['shoes', 'gloves', 'gun']) w.buy(id);
  w.buy('toolSlot');
  w.equip('shoes');
  assert.deepEqual(w.tools, ['gun', 'shoes']);
  w.equip('gloves');
  assert.deepEqual(w.tools, ['shoes', 'gloves'], 'the gun came off first');
  w.equip('shoes');
  assert.deepEqual(w.tools, ['gloves'], 'tapped off');
  assert.deepEqual(w.loadout.tools, ['gloves']);
});

test('2nd sprout slot: pick a first and a backup, the same kind twice if you like', () => {
  const w = new Wallet(memory());
  w.add(2000);
  w.buy('corn');
  assert.deepEqual(w.loadout.sprouts, ['corn'], 'no backup without the slot');
  w.buy('sproutSlot');
  assert.deepEqual(w.loadout.sprouts, ['corn', 'sprout']);
  w.buy('rose', 1);
  assert.deepEqual(w.loadout.sprouts, ['corn', 'rose'], 'bought straight into the backup slot');
  w.equip('corn', 1);
  assert.deepEqual(w.loadout.sprouts, ['corn', 'corn']);
  assert.deepEqual(w.sproutSlotsOf('corn'), [0, 1]);
});

test('level skips: pick one for the next game; it is spent when used', () => {
  const w = new Wallet(memory());
  w.add(200);
  assert.equal(w.startLevel, 1);
  w.buy('skip7');
  assert.equal(w.startLevel, 7, 'bought means picked');
  w.equip('skip7');
  assert.equal(w.startLevel, 1, 'tap again: not this time');
  w.equip('skip7');
  assert.equal(w.buy('skip7'), false, 'one at a time');
  assert.equal(w.use('skip7'), true);
  assert.equal(w.owns('skip7'), false);
  assert.equal(w.startLevel, 1);
  assert.equal(w.buy('skip7'), true, 'and can be bought again');
});

test('the setup page sells level skips but not Revive', () => {
  assert.deepEqual(SKIP_IDS, ['skip3', 'skip7', 'skip10']);
  assert.equal(CATALOG.coat.name, 'Coat');
});

test('a v13 save (one tool, one sprout) still loads', () => {
  const storage = memory();
  storage.setItem(SAVE, JSON.stringify({ coins: 80, owned: ['sprout', 'gun', 'corn'], tool: 'gun', sprout: 'corn' }));
  const w = new Wallet(storage);
  assert.equal(w.coins, 80);
  assert.deepEqual(w.loadout, { tools: ['gun'], sprouts: ['corn'], gadgets: [] });
});

test('a broken or tampered save falls back safely', () => {
  const storage = memory();
  storage.setItem(SAVE, '{"coins":-5,"owned":["laser"],"tools":["gun","shoes"],"sprouts":["corn"],"skip":"skip10"}');
  const w = new Wallet(storage);
  assert.equal(w.coins, 0);
  assert.deepEqual(w.tools, [], 'never bought');
  assert.deepEqual(w.sprouts, ['sprout', 'sprout']);
  assert.equal(w.startLevel, 1);
  storage.setItem(SAVE, 'not json');
  assert.equal(new Wallet(storage).coins, 0);
});

test('prices match the brief', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries({ ...TOOLS, ...SPROUTS, ...GADGETS, ...SLOTS, ...ONCE }).map(([k, v]) => [k, v.price])),
    {
      backpack: 19, shoes: 29, gloves: 29, coat: 49, glasses: 69, gun: 99,
      sprout: 0, daisy: 99, sunflower: 149, rose: 199, corn: 249, lilies: 249, mushroom: 299,
      leaf: 39, spray: 39, fertilizer: 39, shovel: 39,
      toolSlot: 199, sproutSlot: 399, gadgetSlot: 99,
      skip3: 29, skip7: 74, skip10: 99, revive: 49,
    },
  );
  assert.equal(formatK(1250), '1,250K');
});

// ------------------------------------------------------------------ admin

test('admin mode is its own save: everything unlocked, the real save untouched', () => {
  const storage = memory();
  const w = new Wallet(storage);
  w.add(40);
  w.buy('shoes');

  w.open(ADMIN_SAVE);
  assert.equal(w.isAdmin, true);
  assert.equal(w.coins, 9999);
  for (const id of [...TOOL_IDS, ...SPROUT_IDS, ...GADGET_IDS, ...SLOT_IDS, ...ONCE_IDS]) assert.equal(w.owns(id), true, id);
  w.equip('gun');
  w.add(500);

  w.open(SAVE);
  assert.equal(w.isAdmin, false);
  assert.equal(w.coins, 11, 'real coins as they were');
  assert.deepEqual(w.tools, ['shoes']);
  assert.equal(w.owns('gun'), false, 'nothing leaks across');

  w.open(ADMIN_SAVE);
  assert.equal(w.coins, 10499, 'admin save remembered too');
  assert.ok(w.tools.includes('gun'));
});

test('admin: lock all to try buying, unlock all to try everything', () => {
  const w = new Wallet(memory(), ADMIN_SAVE);
  w.equip('coat');
  w.equip('rose');
  w.lockAll();
  assert.equal(w.owns('coat'), false);
  assert.deepEqual(w.loadout, { tools: [], sprouts: ['sprout'], gadgets: [] });
  assert.equal(w.buy('mushroom'), true, 'buying works again');
  w.unlockAll();
  assert.equal(w.owns('gun'), true);
});

test('a game can start at a later level', () => {
  const game = new Game({ rng: () => 0.5 });
  game.reset(undefined, 7);
  assert.equal(game.level, 7);
  assert.equal(game.skillUnlocked, true);
  assert.equal(game.itemsUnlocked, true);
  assert.equal(game.levelSize(7), game.toSpawn);
});

// -------------------------------------------------------------- backpack

test('backpack: coins within 25 units (150) fly to Klayman; farther ones wait', () => {
  assert.equal(TOOLS.backpack.magnet, 150);
  const game = quietGame(wearing('backpack'));
  const k = game.klay;
  game.dropCoin({ x: k.x + 130, y: k.y }, 1);
  game.dropCoin({ x: k.x - 170, y: k.y }, 5);
  run(game, 1.2);
  assert.equal(game.earned, 1, 'the near one ran to him');
  assert.equal(game.coins.length, 1);
  assert.equal(game.coins[0].x, k.x - 170, 'the far one stayed put');

  const plain = quietGame();
  plain.dropCoin({ x: plain.klay.x + 130, y: plain.klay.y }, 1);
  run(plain, 1.2);
  assert.equal(plain.earned, 0, 'no backpack, no magnet');
});

test('backpack: it pulls a coin that drops close by mid-game', () => {
  const game = quietGame(wearing('backpack'));
  const k = game.klay;
  run(game, 0.5);
  game.dropCoin({ x: k.x - 100, y: k.y + 40 }, 5);
  run(game, 1);
  assert.equal(game.earned, 5);
});

// ------------------------------------------------------------------ daisy

test('daisy: from level 1, a coin pops out of the flower every 30 seconds', () => {
  const game = quietGame(planting('daisy'));
  assert.equal(game.level, 1);
  game.drainEvents();
  run(game, 29.9);
  assert.equal(game.coins.length, 0);
  run(game, 0.2);
  assert.equal(game.coins.length, 1);
  const coin = game.coins[0];
  assert.deepEqual({ x: coin.from.x, y: coin.from.y }, game.flowerTop, 'out of the flower');
  const d = dist(coin, game.tree);
  assert.ok(d >= SPROUTS.daisy.drop.min && d <= SPROUTS.daisy.drop.max, `lands ${d.toFixed(0)} away`);
  game.drainEvents();
  run(game, 30);
  assert.equal(game.drainEvents().filter((e) => e.type === 'coinAppears').length, 1, 'and again 30 seconds later');
});

test('daisy: 80% 1K, 19% 5K, 1% 10K', () => {
  const value = (roll) => {
    const game = quietGame(planting('daisy'), () => roll);
    return game.planFlowerCoin().value;
  };
  assert.equal(value(0), 1);
  assert.equal(value(0.799), 1);
  assert.equal(value(0.8), 5);
  assert.equal(value(0.9899), 5);
  assert.equal(value(0.9901), 10);
  assert.equal(value(0.9999), 10);
});

test('daisy: the glasses know the next coin and its worth, 3 seconds early', () => {
  const game = quietGame(planting('daisy'));
  run(game, 27.1);
  const next = game.flowerCoins.next;
  assert.ok(next && [1, 5, 10].includes(next.value));
  run(game, 3);
  assert.deepEqual({ x: game.coins[0].x, y: game.coins[0].y, value: game.coins[0].value }, next);
});

// --------------------------------------------- sunflower and the pot, both

test('sunflower from level 3: its items and the pot’s both come, side by side', () => {
  const game = quietGame(planting('sunflower'));
  game.startLevel(ITEMS.unlockLevel);
  game.phase = 'test';
  game.toSpawn = 0;
  game.potItems.timer = 1;
  game.flowerItems.timer = 1;
  run(game, 1.1);
  assert.equal(game.items.length, 2, 'one from the pot and one from the flower');
  assert.deepEqual(game.items.map((i) => i.glowing).sort(), [false, true]);
});

// ---------------------------------------------------------------- gadgets

const withGadgets = (...gadgets) => ({ gadgets });
const press = (i) => ({ ...NO_INPUT, gadget: i });

test('gadgets cost 39K; the 2nd gadget slot 99K; the 2nd tool slot 199K; the 2nd sprout slot 399K', () => {
  assert.deepEqual(GADGET_IDS.map((id) => GADGETS[id].price), [39, 39, 39, 39]);
  assert.equal(SLOTS.gadgetSlot.price, 99);
  assert.equal(SLOTS.toolSlot.price, 199);
  assert.equal(SLOTS.sproutSlot.price, 399);
});

test('leaf: its wind keeps bacteria out of a ring 25 units round Klayman for 7 seconds, then 20 to cool down', () => {
  assert.equal(GADGETS.leaf.reach, 150);
  assert.equal(GADGETS.leaf.time, 7);
  const game = quietGame(withGadgets('leaf'));
  const k = game.klay;
  k.x = game.tree.x + 160; k.y = game.tree.y;              // standing in the way to the sprout
  const b = game.addBacteria(k.x + 40, k.y);               // already close
  game.drainEvents();
  game.update(STEP, press(0));
  assert.ok(game.drainEvents().some((e) => e.type === 'gadget' && e.id === 'leaf'));
  run(game, 0.6);
  // The ring is flattened like every ring on the pot: 60 across, 36 deep, plus the bacteria's own size.
  const { reach } = GADGETS.leaf;
  const inRing = (p) => Math.hypot((p.x - k.x) / (reach + 13), (p.y - k.y) / (reach * RING_SQUASH + 13));
  assert.ok(inRing(b) >= 0.999, `pushed out (${inRing(b).toFixed(3)})`);
  let closest = Infinity;
  for (let t = 0; t < 6; t += STEP) {
    game.update(STEP);
    if (b.alive) closest = Math.min(closest, dist(b, k));
  }
  assert.ok(closest >= GADGETS.leaf.reach * 0.6, `held off (closest ${closest.toFixed(0)})`);
  assert.equal(k.poisoned, false, 'it never got in');
  const leaf = game.gadgets[0];
  run(game, 0.5);
  assert.equal(leaf.active, false, 'the wind stops after 7 seconds');
  assert.ok(Math.abs(leaf.wait - 20) < 0.5, 'then it cools down for 20');
  game.update(STEP, press(0));
  assert.equal(leaf.active, false, 'it can’t be used while cooling down');
  run(game, leaf.wait + 0.05);
  assert.equal(leaf.ready, true, 'ready again once it has cooled down');
});

test('mist spray: sprays the sprout twice in 0.75 seconds, half a heart back', () => {
  assert.equal(GADGETS.spray.time, 0.75);
  const game = quietGame(withGadgets('spray'));
  game.lives = 1;
  game.drainEvents();
  game.update(STEP, press(0));
  run(game, GADGETS.spray.time + 0.1);
  const events = game.drainEvents();
  assert.equal(events.filter((e) => e.type === 'mist').length, 2);
  assert.equal(game.lives, 1.5);
  assert.equal(game.gadgets[0].wait > 19, true, 'then 20 seconds to cool down');
  game.gadgets[0].wait = 0;
  game.lives = game.maxLives;
  game.update(STEP, press(0));
  run(game, GADGETS.spray.time + 0.1);
  assert.equal(game.lives, game.maxLives, 'never past full');
});

test('fertilizer: every bacteria crawls 70% slower for 5 seconds', () => {
  const crawl = (fed) => {
    const game = quietGame(withGadgets('fertilizer'));
    const b = game.addBacteria(game.tree.x + 300, game.tree.y);
    if (fed) game.update(STEP, press(0));
    const x0 = b.x;
    run(game, 2);
    return x0 - b.x;
  };
  const ratio = crawl(true) / crawl(false);
  assert.ok(Math.abs(ratio - 0.3) < 0.03, `crawled ${(ratio * 100).toFixed(0)}% as far`);
  const game = quietGame(withGadgets('fertilizer'));
  game.update(STEP, press(0));
  run(game, 5.1);
  assert.equal(game.pace, 1, 'over after 5 seconds');
});

test('two gadgets with the 2nd gadget slot, each on its own key', () => {
  const w = new Wallet(memory());
  w.add(500);
  w.buy('leaf');
  w.buy('spray');
  assert.deepEqual(w.loadout.gadgets, ['spray'], 'one slot: the new one swaps in');
  w.buy('gadgetSlot');
  w.equip('leaf');
  assert.deepEqual(w.loadout.gadgets, ['spray', 'leaf']);
  w.buy('fertilizer');
  assert.deepEqual(w.loadout.gadgets, ['leaf', 'fertilizer'], 'a third swaps out the oldest');
  w.equip('noGadget');
  assert.deepEqual(w.loadout.gadgets, []);

  const game = quietGame(withGadgets('leaf', 'spray'));
  game.update(STEP, press(1));
  assert.deepEqual(game.gadgets.map((g) => g.active), [false, true]);
});

test('gadgets are saved with the wallet', () => {
  const storage = memory();
  const w = new Wallet(storage);
  w.add(200);
  w.buy('gadgetSlot');
  w.buy('leaf');
  w.buy('fertilizer');
  const again = new Wallet(storage);
  assert.deepEqual(again.loadout.gadgets, ['leaf', 'fertilizer']);
});

test('shovel: Klayman digs for 0.75 seconds; every bacteria within 30 units gets a layer of dirt', () => {
  assert.equal(GADGETS.shovel.reach, 180);
  const game = quietGame(withGadgets('shovel'));
  const k = game.klay;
  const near = game.addBacteria(k.x + 120, k.y);
  const dirty = game.addBacteria(k.x - 100, k.y + 20);
  dirty.addDirt(2);
  const deep = game.addBacteria(k.x, k.y - 60);
  deep.addDirt(BACTERIA.maxDirt - 1);                 // one throw from a dirtball
  const far = game.addBacteria(k.x + 260, k.y);
  const ball = game.addDirtball(k.x + 60, k.y + 40);
  game.drainEvents();
  game.update(STEP, press(0));
  const x0 = k.x;
  run(game, 0.3, { ...NO_INPUT, x: 1, pressed: true });
  assert.equal(k.x, x0, 'he stands still while he digs');
  assert.equal(game.shots.length, 0, 'and doesn’t throw');
  assert.equal(near.dirt, 0, 'nothing yet: the blade is still going in');
  run(game, 0.2);
  assert.ok(game.drainEvents().some((e) => e.type === 'dig'));
  assert.equal(near.dirt, 1, 'a clean one gets its first layer');
  assert.equal(dirty.dirt, 3, 'a dirty one a layer more');
  assert.equal(deep.dead, true, 'and one on its last layer becomes a dirtball');
  assert.equal(far.dirt, 0, 'outside the ring: nothing');
  assert.equal(ball.state, 'idle', 'dirtballs don’t mind');
  assert.equal(game.dirtballs.length, 2);
  run(game, 0.3, { ...NO_INPUT, x: 1 });
  assert.ok(k.x > x0, 'done after 0.75 seconds: he walks again');
  assert.ok(game.gadgets[0].wait > 19, 'and the shovel needs 20 seconds');
});

test('the glasses’ sprout clocks: what comes next, and when', () => {
  const clocks = (sprout, set = () => {}) => {
    const game = quietGame(planting(sprout));
    set(game);
    return game.sproutClocks.map((c) => `${c.power} ${Math.ceil(c.secs)}`);
  };
  assert.deepEqual(clocks('sprout'), []);
  assert.deepEqual(clocks('daisy'), ['coin 30']);
  assert.deepEqual(clocks('sunflower'), ['item 30']);
  assert.deepEqual(clocks('rose'), ['heal 20']);
  assert.deepEqual(clocks('corn'), ['closes 40']);
  assert.deepEqual(clocks('corn', (g) => { g.shield = 9; }), ['opens 9'], 'while closed: when it opens');
  assert.deepEqual(clocks('lilies', (g) => { g.hidden = 4.2; }), ['opens 5']);
  assert.deepEqual(clocks('mushroom'), ['spores 25', 'heal 30', 'grow 50']);
  assert.deepEqual(clocks('mushroom', (g) => { g.maxLives = 9; }), ['spores 25', 'heal 30'], 'fully grown: no more growing');
});

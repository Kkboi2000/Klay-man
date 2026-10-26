// Tools, sprouts, slots, one-use items, coins and the shop. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { BACTERIA, COINS, ITEMS, ONCE, REVIVE, SHOT, SLOTS, SPROUTS, TOOLS, TREE } from './config.js';
import { Wallet, gearFor, formatK, SAVE, ADMIN_SAVE, TOOL_IDS, SPROUT_IDS, SLOT_IDS, ONCE_IDS, SKIP_IDS, CATALOG } from './gear.js';
import { SOIL, TREE_SPOT, dist, insideRing, insideSoil } from './world.js';

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

test('sunflower: every 35 seconds an item pops out of the flower and lands near it', () => {
  const game = quietGame(planting('sunflower'));
  game.startLevel(ITEMS.unlockLevel);
  game.phase = 'test';
  game.toSpawn = 0;
  game.drainEvents();
  run(game, 34.5);
  assert.equal(game.item, null);
  run(game, 0.6);
  const item = game.item;
  assert.ok(item);
  const pop = game.drainEvents().find((e) => e.type === 'itemAppears');
  assert.deepEqual(pop.from, game.flowerTop, 'out of the flower');
  const d = dist(item, game.tree);
  assert.ok(d >= SPROUTS.sunflower.drop.min && d <= SPROUTS.sunflower.drop.max, `landed ${d} away`);

  // It can't be caught in the air.
  game.klay.x = item.x; game.klay.y = item.y;
  game.update(STEP);
  assert.equal(game.item, item, 'still flying');
  run(game, 0.7);
  assert.equal(game.item, null, 'picked up once it landed');
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

test('mushroom: every 25s, spores push crawlers inside the ring 60 back and slow them', () => {
  const m = SPROUTS.mushroom.spores;
  assert.equal(m.push, 60);
  assert.ok(Math.abs(m.reach - 330 * 0.75) < 1, 'a ring 25% smaller than 330');
  const game = quietGame(planting('mushroom'));
  game.sporeTimer = 0.01;
  game.healTimer = Infinity;
  const near = game.addBacteria(game.tree.x + 100, game.tree.y);
  const out = game.addBacteria(game.tree.x + m.reach + 30, game.tree.y);
  const dirty = game.addBacteria(game.tree.x - 100, game.tree.y);
  dirty.addDirt(1);
  const before = { near: dist(near, game.tree), out: dist(out, game.tree), dirty: { x: dirty.x, y: dirty.y } };
  run(game, 0.5);
  const pushed = dist(near, game.tree) - before.near;
  assert.ok(pushed > 45 && pushed < 75, `pushed ${pushed.toFixed(0)}`);
  assert.equal(near.slowed, true);
  assert.ok(dist(out, game.tree) < before.out, 'outside the ring: not pushed');
  assert.equal(out.slowed, false);
  assert.deepEqual({ x: dirty.x, y: dirty.y }, before.dirty, 'a dirty one stays');
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
  assert.deepEqual(w.loadout, { tools: [], sprouts: ['rose'] });
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
  assert.deepEqual(w.loadout, { tools: ['gun'], sprouts: ['corn'] });
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
    Object.fromEntries(Object.entries({ ...TOOLS, ...SPROUTS, ...SLOTS, ...ONCE }).map(([k, v]) => [k, v.price])),
    {
      shoes: 29, gloves: 29, coat: 49, glasses: 69, gun: 99,
      sprout: 0, sunflower: 149, rose: 199, corn: 249, lilies: 249, mushroom: 299,
      toolSlot: 499, sproutSlot: 999,
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
  for (const id of [...TOOL_IDS, ...SPROUT_IDS, ...SLOT_IDS, ...ONCE_IDS]) assert.equal(w.owns(id), true, id);
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
  assert.deepEqual(w.loadout, { tools: [], sprouts: ['sprout'] });
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

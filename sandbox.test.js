// Admin mode's sandbox (v27): changes to the game in play. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { LEVELS } from './config.js';

const STEP = 1 / 60;
const run = (game, seconds) => { for (let t = 0; t < seconds; t += STEP) game.update(STEP, NO_INPUT); };

test('sandbox: any tools, two gadgets at most, any seasons mixed, another sprout', () => {
  const game = new Game({ rng: () => 0.5 });
  game.wear(['gloves', 'gun', 'bazoo', 'coat', 'nope']);
  assert.deepEqual(game.gear.tools, ['gloves', 'gun', 'bazoo', 'coat']);
  assert.equal(game.gear.bazoo && game.gear.immune && game.gear.lockOn, true);
  game.carry(['leaf', 'spray', 'booster']);
  assert.deepEqual(game.gadgets.map((g) => g.id), ['leaf', 'spray'], 'two buttons, two gadgets');
  game.playIn(['winter', 'rainy', 'summer']);
  assert.deepEqual(game.seasons, ['winter', 'rainy', 'summer']);
  assert.ok(game.weather.storm && game.weather.sun && game.weather.bacteriaPace < 1, 'all three at once');
  assert.ok(game.stormTimer > 0, 'the storm clock is running');
  game.replant('corn');
  assert.equal(game.gear.sprout, 'corn');
  assert.equal(game.lives, 6);
});

test('sandbox: hearts, kinds on demand, spawning held, the pot cleared', () => {
  const game = new Game({ rng: () => 0.5 });
  game.setHearts(2, 9);
  assert.deepEqual([game.lives, game.maxLives], [2, 9]);
  game.setHearts(-3);
  assert.equal(game.lives, 0.5, 'never below half a heart');
  for (const kind of ['green', 'yellow', 'blue']) assert.equal(game.spawnKind(kind).kind, kind);
  game.held = true;
  const before = game.bacteria.length;
  run(game, LEVELS.bannerTime + 6);
  assert.equal(game.bacteria.length, before, 'held: none come');
  game.dropItem('sandclock');
  game.dropCoinNear(5);
  assert.equal(game.items.at(-1).type, 'sandclock');
  assert.equal(game.coins.at(-1).value, 5);
  game.clearPot();
  assert.equal(game.bacteria.length + game.dirtballs.length + game.germs.length, 0);
});

test('sandbox: jump a survival game to a level; set a timer run’s clock', () => {
  const game = new Game({ rng: () => 0.5 });
  game.jumpTo(24);
  assert.equal(game.level, 24);
  assert.equal(game.toSpawn, game.levelSize(24));
  const timed = new Game({ rng: () => 0.5 });
  timed.reset(undefined, 1, 't5');
  timed.setClock(5);
  assert.equal(timed.run.left, 5);
  timed.jumpTo(9);
  assert.equal(timed.level, 1, 'a run has no levels to jump');
});

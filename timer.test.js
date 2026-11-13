// Timer mode (v26): three runs against the clock, bacteria out of the pot's
// corners, faster every 20 seconds. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, NO_INPUT } from './game.js';
import { BOSS, LEVELS, TIMER } from './config.js';
import { ADMIN_SAVE, RUN_IDS, SAVE, Wallet, runName } from './gear.js';
import { bossSpawnEvery } from './boss.js';
import { SOIL, dist, rimPoint } from './world.js';

const STEP = 1 / 60;
const run = (game, seconds, input = NO_INPUT) => {
  for (let t = 0; t < seconds; t += STEP) game.update(STEP, input);
};

function memory() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
}

/** A timer run with a sprout that can't be lost, Klayman parked out of the way. */
function sturdyRun(id = 't1', rng = () => 0.5) {
  const game = new Game({ rng });
  game.reset(undefined, 1, id);
  game.lives = game.maxLives = 10000;
  game.klay.x = SOIL.cx;
  game.klay.y = SOIL.cy + 150;
  game.coinTimer = Infinity;
  return game;
}

const CORNERS = [-3, -1, 1, 3].map((k) => rimPoint((k * Math.PI) / 4, TIMER.corner));
const nearCorner = (p) => Math.min(...CORNERS.map((c) => dist(p, c)));

// ------------------------------------------------------------------ runs

test('three runs: 1, 3 and 5 minutes, for 49K, 179K and 289K', () => {
  assert.deepEqual(RUN_IDS, ['t1', 't3', 't5']);
  assert.deepEqual(RUN_IDS.map((id) => [TIMER.runs[id].secs, TIMER.runs[id].prize]), [[60, 49], [180, 179], [300, 289]]);
  assert.deepEqual(RUN_IDS.map(runName), ['1 minute', '3 minutes', '5 minutes']);
});

test('3 and 5 minutes open only once the run before is won; every win pays', () => {
  const storage = memory();
  const w = new Wallet(storage);
  assert.deepEqual(RUN_IDS.map((id) => w.runOpen(id)), [true, false, false], 'only 1 minute to start with');
  assert.deepEqual(w.winRun('t1'), { prize: 49, opened: 't3' });
  assert.equal(w.coins, 49);
  assert.deepEqual(RUN_IDS.map((id) => w.runOpen(id)), [true, true, false]);
  assert.deepEqual(w.winRun('t1'), { prize: 49, opened: null }, 'won again: paid again, nothing new to open');
  assert.deepEqual(w.winRun('t3'), { prize: 179, opened: 't5' });
  assert.deepEqual(w.winRun('t5'), { prize: 289, opened: null }, 'the last run opens nothing');
  assert.equal(w.coins, 49 * 2 + 179 + 289);
  const again = new Wallet(storage);
  assert.deepEqual(RUN_IDS.map((id) => again.runOpen(id)), [true, true, true], 'remembered');
});

test('admin mode opens every run; Lock all closes them; the real save is untouched', () => {
  const storage = memory();
  const w = new Wallet(storage);
  w.open(ADMIN_SAVE);
  assert.deepEqual(RUN_IDS.map((id) => w.runOpen(id)), [true, true, true]);
  w.lockAll();
  assert.deepEqual(RUN_IDS.map((id) => w.runOpen(id)), [true, false, false]);
  w.open(SAVE);
  assert.equal(w.runOpen('t3'), false);
});

// ------------------------------------------------------------- the game

test('a run: bacteria come out of the corners, as fast as a level-5 boss sends them, and never stop', () => {
  const game = sturdyRun('t1', Math.random);
  assert.equal(game.timed, true);
  assert.equal(game.spawnEvery, bossSpawnEvery(BOSS.firstLevel));
  assert.equal(game.spawnEvery, 3.125);
  const seen = [];
  const add = game.addBacteria.bind(game);
  game.addBacteria = (x, y) => { seen.push({ x, y }); return add(x, y); };
  run(game, LEVELS.bannerTime + 19.5);
  assert.equal(seen.length, 7, 'one at 0.4 s, then one every 3.125 s');
  const give = SOIL.rx * TIMER.spread + 2;     // the little either side of a corner they're allowed
  for (const p of seen) assert.ok(nearCorner(p) < give, `out of a corner: ${Math.round(nearCorner(p))} away`);
  assert.equal(game.boss, null, 'no boss');
  assert.ok(Number.isFinite(game.bacteriaLeft), 'the glasses count what is in the pot');
});

test('every 20 seconds they come 25% more often and crawl 25% faster: added, not compounded', () => {
  const game = sturdyRun('t5');
  run(game, LEVELS.bannerTime + 19.9);
  assert.equal(game.surge, 1);
  game.drainEvents();
  run(game, 0.2);
  assert.equal(game.surge, 1.25);
  assert.ok(game.drainEvents().some((e) => e.type === 'surge'));
  assert.ok(Math.abs(game.spawnEvery - 3.125 / 1.25) < 1e-9);
  assert.ok(Math.abs(game.pace - 1.25) < 1e-9, 'every bacteria crawls 25% faster, those already out too');
  run(game, 80);
  assert.equal(game.surge, 2.25, 'five steps in: 1 + 5 x 25%');
  assert.ok(Math.abs(game.spawnEvery - 3.125 / 2.25) < 1e-9);
});

test('the clock waits for the banner, and a sandclock holds the bacteria, never the clock', () => {
  const game = sturdyRun('t1');
  run(game, LEVELS.bannerTime - 0.1);
  assert.equal(game.run.left, 60, 'not started while the banner shows');
  run(game, 1.1);
  assert.ok(game.run.left < 60);
  const out = game.bacteria.length;
  const left = game.run.left;
  game.freeze = 10;
  run(game, 5);
  assert.equal(game.bacteria.length, out, 'frozen: none come');
  assert.ok(Math.abs(game.run.left - (left - 5)) < 0.05, 'but the clock runs');
});

test('time’s up with the sprout still there: every bacteria pops, and the run is won', () => {
  const game = sturdyRun('t1');
  run(game, LEVELS.bannerTime + 59.9);
  assert.equal(game.won, false);
  assert.ok(game.bacteria.some((b) => b.alive), 'bacteria about');
  game.drainEvents();
  run(game, 0.2);
  let events = game.drainEvents();
  assert.ok(events.some((e) => e.type === 'timeUp'));
  assert.ok(events.some((e) => e.type === 'pop'));
  assert.equal(game.won, true);
  assert.equal(game.bacteria.some((b) => b.alive), false, 'all popped');
  const lives = game.lives;
  game.addBacteria(game.tree.x + 5, game.tree.y);
  run(game, TIMER.lap - 0.3);
  assert.equal(game.lives, lives, 'nothing gets at the sprout now');
  assert.equal(game.over, false, 'a moment to see it');
  run(game, 0.4);
  events = game.drainEvents();
  assert.ok(events.some((e) => e.type === 'won' && e.run === 't1'));
  assert.equal(game.over, true);
  assert.equal(game.canRevive, false, 'nothing to revive');
});

test('losing the sprout ends a run with how long it lasted; a revive or the backup carries the clock on', () => {
  const game = new Game({ rng: () => 0.5, loadout: { sprouts: ['sprout', 'rose'] } });
  game.reset({ sprouts: ['sprout', 'rose'] }, 1, 't3');
  game.lives = 1;
  game.klay.x = SOIL.cx;                    // out of the bacteria's way: he'd swallow one
  game.klay.y = SOIL.cy + 150;
  run(game, LEVELS.bannerTime + 40);
  const over = game.drainEvents().find((e) => e.type === 'gameover');
  assert.ok(over, 'lost');
  assert.equal(over.run, 't3');
  assert.ok(over.lasted > 0 && over.lasted < 40, `lasted ${over.lasted.toFixed(1)} s`);
  const left = game.run.left;
  assert.equal(game.useBackup(), true);
  assert.equal(game.run.left, left, 'the clock picks up where it stopped');
  run(game, 1);
  assert.ok(game.run.left < left);
});

test('survival is as it was: no clock, no surge', () => {
  const game = new Game({ rng: () => 0.5 });
  assert.equal(game.timed, false);
  assert.equal(game.surge, 1);
  assert.equal(game.won, false);
  assert.equal(game.itemsUnlocked, false, 'items from level 3, as ever');
  assert.equal(sturdyRun().itemsUnlocked, true, 'a run has them from the start');
});

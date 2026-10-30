// Which way round each page is shown (v24). Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_WAYS, createOrientation, toLocal, turnFor, wayFor } from './orientation.js';

test('title and setup are always upright; a game is the player’s way, sideways to start', () => {
  assert.deepEqual(GAME_WAYS, ['landscape', 'portrait']);
  assert.equal(wayFor(false, 'landscape'), 'portrait');
  assert.equal(wayFor(false, 'portrait'), 'portrait');
  assert.equal(wayFor(true, 'landscape'), 'landscape');
  assert.equal(wayFor(true, 'portrait'), 'portrait');
  assert.equal(createOrientation().gameWay, 'landscape', 'nothing saved: sideways');
});

test('a screen that’s already the right shape is never turned', () => {
  assert.equal(turnFor('portrait', 390, 844, 0), 0);
  assert.equal(turnFor('landscape', 844, 390, 90), 0);
  assert.equal(turnFor('landscape', 844, 390, 270), 0);
});

test('setup with the phone held sideways: the page lines up with the phone again', () => {
  // The phone turned the screen a quarter (90 or 270): turn it back.
  assert.equal(turnFor('portrait', 844, 390, 90), -90);
  assert.equal(turnFor('portrait', 844, 390, 270), 90);
  assert.equal(turnFor('portrait', 844, 390, -90), 90, 'the same as 270');
});

test('a sideways game on a phone held upright (or locked upright) is turned clockwise', () => {
  assert.equal(turnFor('landscape', 390, 844, 0), 90);
  assert.equal(turnFor('landscape', 390, 844, 180), -90);
});

test('touches are turned back onto the page', () => {
  const w = 390;
  const h = 844;
  assert.deepEqual(toLocal(0, w, h, 10, 20), { x: 10, y: 20 });
  // Turned 90: the page's top left sits at the screen's top right.
  assert.deepEqual(toLocal(90, w, h, w, 0), { x: 0, y: 0 });
  assert.deepEqual(toLocal(90, w, h, 0, h), { x: h, y: w }, 'and its bottom right at the screen’s bottom left');
  assert.deepEqual(toLocal(90, w, h, w - 30, 100), { x: 100, y: 30 });
  // Turned -90: the page's top left sits at the screen's bottom left.
  assert.deepEqual(toLocal(-90, w, h, 0, h), { x: 0, y: 0 });
  assert.deepEqual(toLocal(-90, w, h, 30, h - 100), { x: 100, y: 30 });
  // A drag keeps its length, whichever way it's turned.
  for (const turn of [0, 90, -90]) {
    const a = toLocal(turn, w, h, 100, 200);
    const b = toLocal(turn, w, h, 130, 240);
    assert.equal(Math.hypot(b.x - a.x, b.y - a.y), 50, `turn ${turn}`);
  }
});

test('on a computer nothing is ever turned', () => {
  const o = createOrientation({ handheld: false });
  o.want('landscape');
  assert.equal(o.measure().turn, 0);
});

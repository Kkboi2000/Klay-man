// The screen-turning rule. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrientationRule, heldWay } from './orientation.js';

test('a game opens sideways even if the phone is held upright; turning it afterwards wins', () => {
  const rule = new OrientationRule();
  rule.sense('portrait');
  assert.equal(rule.prefer('portrait'), 'portrait', 'title: upright');
  assert.equal(rule.prefer('landscape'), 'landscape', 'a game opens sideways');
  assert.equal(rule.sense('portrait'), null, 'still held upright: the game stays sideways');
  assert.equal(rule.sense('landscape'), null, 'turned to match: nothing to do');
  assert.equal(rule.sense('portrait'), 'portrait', 'turned back upright: the game follows');
});

test('the title opens upright; turning the phone sideways turns it', () => {
  const rule = new OrientationRule();
  rule.sense('portrait');
  rule.prefer('portrait');
  assert.equal(rule.sense('landscape'), 'landscape');
  assert.equal(rule.sense(null), null, 'lying flat changes nothing');
  assert.equal(rule.sense('portrait'), 'portrait');
});

test('which way a phone is held, from gravity', () => {
  assert.equal(heldWay(0.5, -9.6), 'portrait');
  assert.equal(heldWay(9.5, 1), 'landscape');
  assert.equal(heldWay(-9.5, 1), 'landscape');
  assert.equal(heldWay(0.3, 0.4), null, 'flat on a table');
  assert.equal(heldWay(6, 6), null, 'tilted halfway');
  assert.equal(heldWay(0.5, -9.6, false), 'landscape', 'a tablet that is wide by nature');
});

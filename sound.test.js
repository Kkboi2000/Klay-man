// The music loop (v25): it plays to its real end, rests a second, and comes
// round again. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loopPoints, withGap } from './sound.js';

/** Just enough of an AudioContext to build buffers in Node. */
const fakeCtx = {
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (c) => data[c] };
  },
};

test('the music rests 1 second after it ends, then starts again from its real start', () => {
  const rate = 1000;
  // 0.1 s of silence, 2 s of music, 0.2 s of silence: as an MP3 decodes.
  const music = fakeCtx.createBuffer(2, 2300, rate);
  for (let c = 0; c < 2; c++) {
    const d = music.getChannelData(c);
    for (let i = 100; i < 2100; i++) d[i] = 0.5 * (c ? -1 : 1);
  }
  const span = loopPoints(music.getChannelData(0), rate);
  assert.equal(span.start, 0.1);
  assert.equal(span.end, 2.1);
  const played = withGap(fakeCtx, music, span, 1);
  assert.equal(played.length, 3000, '2 seconds of music, then 1 of quiet');
  for (let c = 0; c < 2; c++) {
    const d = played.getChannelData(c);
    assert.equal(d[1000], 0.5 * (c ? -1 : 1), 'the music itself, untouched in the middle');
    assert.ok(d.subarray(2000).every((v) => v === 0), 'then a full second of silence');
    assert.ok(d[0] === 0, 'eased in from silence...');
    assert.ok(d[1999] === 0, '...and out into it: no click');
    assert.ok(Math.abs(d[30]) > Math.abs(d[5]), 'over a few milliseconds');
  }
});

// Web Audio: quick, overlapping sound effects, and the background music.
// Phones keep audio locked until the first tap, so unlock() is called from
// the buttons that start things. The gun, coin, shop and bling sounds are
// made here in code (makeSynths, at start-up) rather than loaded from files.
//
// Music is off until switched on, and has its own switch: Sound off silences
// the effects, Music off the music. It loops sample-exact from a decoded
// buffer, so there's no click each time round (an <audio loop> would have one).
import { assetUrl } from './sprites.js';

const MUTE_KEY = 'klayman.muted';
const MUSIC_KEY = 'klayman.music';
const MUSIC_FILE = 'music.mp3';
const EFFECTS_VOLUME = 0.5;        // every sound effect, at half what each asks for
const MUSIC_VOLUME = 0.3;

/** Where the music really starts and ends: an MP3 can carry a few silent
 *  samples at either end, and looping those would click. */
export function loopPoints(samples, rate) {
  let first = 0;
  while (first < samples.length - 1 && Math.abs(samples[first]) < 1e-4) first++;
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last]) < 1e-5) last--;
  return { start: first / rate, end: (last + 1) / rate };
}

function base64ToBuffer(dataUrl) {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function fetchBytes(path) {
  const url = assetUrl(path);
  if (url.startsWith('data:')) return base64ToBuffer(url);
  const res = await fetch(url);
  return res.arrayBuffer();
}

/** A mono buffer filled by `wave(t)` for `seconds`. */
function synth(ctx, seconds, wave) {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * rate), rate);
  const out = buffer.getChannelData(0);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, wave(i / rate)));
  return buffer;
}

const square = (f, t) => (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1);

const SYNTHS = {
  // A dry pop: noise that dies fast, over a thump that drops in pitch.
  gun: [0.16, (t) => {
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 38);
    const thump = Math.sin(2 * Math.PI * (150 - 520 * t) * t) * Math.exp(-t * 22);
    return 0.55 * noise + 0.6 * thump;
  }],
  // The classic two-note coin.
  coin: [0.28, (t) => {
    const f = t < 0.07 ? 988 : 1319;
    const env = t < 0.07 ? 1 : Math.exp(-(t - 0.07) * 14);
    return 0.28 * square(f, t) * env;
  }],
  // A sunflower's bling: a quick sparkle of high notes, ringing out.
  bling: [0.5, (t) => {
    const notes = [1568, 2093, 2637, 3136];
    const n = Math.min(3, Math.floor(t / 0.05));
    const env = Math.exp(-(t - n * 0.05) * 16) * (n < 3 ? 1 : Math.exp(-(t - 0.15) * 6));
    return 0.16 * Math.sin(2 * Math.PI * notes[n] * t) * env + 0.05 * square(notes[n] * 2, t) * env;
  }],
  // Three rising notes: bought it.
  buy: [0.42, (t) => {
    const notes = [659, 831, 988];
    const n = Math.min(2, Math.floor(t / 0.09));
    const env = n < 2 ? 1 : Math.exp(-(t - 0.18) * 9);
    return 0.25 * square(notes[n], t) * env;
  }],
};

export class Sound {
  constructor() {
    this.buffers = {};
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.ctx = Ctx ? new Ctx() : null;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
    try { this.musicOn = localStorage.getItem(MUSIC_KEY) === '1'; } catch { this.musicOn = false; }
    this.music = null;             // the decoded loop, once wanted
    this.musicNode = null;         // the loop while it plays
    this.loadingMusic = null;
    // Respect the phone's silent switch and let the player's music keep going.
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch { /* not supported */ }
  }

  async load(names) {
    if (!this.ctx) return;
    await Promise.all(names.map(async (name) => {
      try {
        const bytes = await fetchBytes(`${name}.mp3`);
        this.buffers[name] = await new Promise((ok, fail) => this.ctx.decodeAudioData(bytes, ok, fail));
      } catch { /* a missing sound should never stop the game */ }
    }));
  }

  /** Builds the sounds that are made in code. */
  makeSynths() {
    if (!this.ctx) return;
    for (const [name, [seconds, wave]] of Object.entries(SYNTHS)) {
      try { this.buffers[name] = synth(this.ctx, seconds, wave); } catch { /* skip it */ }
    }
  }

  unlock() {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') { this.startMusic(); return; }
    this.ctx.resume().then(() => this.startMusic(), () => {});
  }

  // ------------------------------------------------------------------ music

  /** Fetches and decodes the loop the first time music is wanted. */
  loadMusic() {
    if (!this.ctx) return Promise.resolve(null);
    this.loadingMusic ??= fetchBytes(MUSIC_FILE)
      .then((bytes) => new Promise((ok, fail) => this.ctx.decodeAudioData(bytes, ok, fail)))
      .then((buffer) => {
        this.music = buffer;
        this.musicLoop = loopPoints(buffer.getChannelData(0), buffer.sampleRate);
        return buffer;
      })
      .catch(() => null);          // no music is never a reason to stop the game
    return this.loadingMusic;
  }

  setMusic(on) {
    this.musicOn = on;
    try { localStorage.setItem(MUSIC_KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /** Starts the loop if music is on and audio is unlocked. Safe to call often. */
  startMusic() {
    if (!this.musicOn || this.musicNode || !this.ctx) return;
    if (!this.music) { this.loadMusic().then(() => this.startMusic()); return; }
    if (this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.music;
    src.loop = true;
    src.loopStart = this.musicLoop.start;
    src.loopEnd = this.musicLoop.end;
    const gain = this.ctx.createGain();
    gain.gain.value = MUSIC_VOLUME;
    src.connect(gain).connect(this.ctx.destination);
    src.start(0, this.musicLoop.start);
    this.musicNode = src;
  }

  stopMusic() {
    if (!this.musicNode) return;
    try { this.musicNode.stop(); } catch { /* already stopped */ }
    this.musicNode = null;
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
  }

  play(name, { volume = 1, rate = 1 } = {}) {
    const buffer = this.buffers[name];
    if (this.muted || !buffer || !this.ctx || this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume * EFFECTS_VOLUME;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  buzz(ms) {
    if (!this.muted) navigator.vibrate?.(ms);
  }
}

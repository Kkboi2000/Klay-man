// Web Audio: quick, overlapping sound effects. Phones keep audio locked until
// the first tap, so unlock() is called from the Start button.
import { assetUrl } from './sprites.js';

const MUTE_KEY = 'klayman.muted';

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

export class Sound {
  constructor() {
    this.buffers = {};
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.ctx = Ctx ? new Ctx() : null;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
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

  unlock() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
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
    gain.gain.value = volume;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  buzz(ms) {
    if (!this.muted) navigator.vibrate?.(ms);
  }
}

// How each season looks (what each one does is in game.js). Drawn by
// render.js in three layers:
//   ground()  on the soil, under everything standing on it: autumn's shade
//             of big trees round the pot, swaying a little;
//   over()    over the pot: summer's sun spotlighting the sprout, and the
//             rainy season's lightning;
//   screen()  over the whole view: summer brighter, winter a little blue,
//             a spring breeze now and then, autumn leaves drifting down,
//             light rain, a lightning flash.
// With reduced motion: no falling rain or breeze, a softer flash.
import { SOIL, WORLD } from './world.js';

const SUN_TIME = 2.4;            // seconds the sun spotlights the sprout
const BOLT_TIME = 0.35;          // seconds a lightning bolt stays
const SHADE = 5;                 // autumn's shade is drawn in blocks this big (world units)

/** The same "random" every time, so autumn's trees stand still between games. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Autumn: the shade of big trees standing round the pot, their canopies
 *  reaching over the rim. Leafy clumps and a few branches, in blocks. */
function treeShade() {
  const c = document.createElement('canvas');
  c.width = Math.ceil(WORLD.w / SHADE);
  c.height = Math.ceil(WORLD.h / SHADE);
  const g = c.getContext('2d');
  const rnd = seeded(7);
  const cx = SOIL.cx / SHADE;
  const cy = SOIL.cy / SHADE;
  const r = SOIL.rx / SHADE;
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  const dot = (x, y, rad) => {
    g.beginPath();
    g.arc(Math.round(x), Math.round(y), Math.round(rad), 0, Math.PI * 2);
    g.fill();
  };
  for (const deg of [205, 318, 52, 128]) {
    const a = (deg * Math.PI) / 180;
    // The trunk stands outside the pot; its canopy reaches over the rim.
    const tx = cx + Math.cos(a) * (r + 46);
    const ty = cy + Math.sin(a) * (r + 46);
    const kx = cx + Math.cos(a) * (r - 4);
    const ky = cy + Math.sin(a) * (r - 4);
    for (let b = 0; b < 3; b++) {
      const spread = a + Math.PI + (b - 1) * 0.5;
      const len = 26 + rnd() * 16;
      g.lineWidth = 3 - b * 0.6;
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo(kx, ky, kx + Math.cos(spread) * len * 0.4, ky + Math.sin(spread) * len * 0.4);
      g.stroke();
    }
    for (let i = 0; i < 46; i++) {
      const d = Math.sqrt(rnd()) * 30;
      const t = rnd() * Math.PI * 2;
      dot(kx + Math.cos(t) * d * 1.15, ky + Math.sin(t) * d, 2.5 + rnd() * 4);
    }
  }
  return c;
}

export class Weather {
  constructor({ calm = false } = {}) {
    this.calm = calm;
    this.shade = null;           // autumn's shade, drawn the first time it's needed
    this.clear();
  }

  /** Forgets everything in flight: a new game, or a new look on the setup page. */
  clear() {
    this.t = 0;
    this.sun = 0;                // seconds the sun still spotlights the sprout
    this.sunAt = null;
    this.bolts = [];
    this.flash = 0;
    this.gust = 0;               // seconds left of a spring breeze...
    this.nextGust = 2.5;         // ...and until the next one
    this.streaks = [];
    this.petals = [];
    this.drops = [];
    this.leaves = [];            // autumn: a few leaves drifting down
  }

  handle(e, cam) {
    if (e.type === 'sunshine') {
      this.sun = SUN_TIME;
      this.sunAt = { x: e.x, y: e.y };
    } else if (e.type === 'lightning') {
      // A jagged bolt from above the screen down to what it hit.
      const top = cam.y - 40;
      const points = [];
      const steps = 9;
      for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        const swing = i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * 26;
        points.push({ x: e.x + swing + (1 - k) * 30, y: top + (e.y - 20 - top) * k });
      }
      this.bolts.push({ points, t: 0 });
      this.flash = this.calm ? 0.25 : 0.6;
    }
  }

  /** On the soil, under everything standing on it. */
  ground(ctx, season) {
    if (season !== 'autumn') return;
    this.shade ??= treeShade();
    const sway = this.calm ? 0 : Math.sin(this.t * 0.7) * 4;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.shade, sway, sway * 0.5, this.shade.width * SHADE, this.shade.height * SHADE);
    ctx.restore();
  }

  /** Over the pot: the sun on the sprout, and lightning. */
  over(ctx, dt) {
    if (this.sun > 0 && this.sunAt) {
      this.sun = Math.max(0, this.sun - dt);
      const k = Math.min(1, (SUN_TIME - this.sun) / 0.35, this.sun / 0.5);
      const { x, y } = this.sunAt;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // A shaft of light from above: three widths over each other, so its edges are soft.
      const beam = ctx.createLinearGradient(0, y - 460, 0, y);
      beam.addColorStop(0, 'rgba(255, 236, 160, 0)');
      beam.addColorStop(1, `rgba(255, 228, 140, ${0.12 * k})`);
      ctx.fillStyle = beam;
      for (const [top, bottom] of [[12, 34], [22, 54], [32, 74]]) {
        ctx.beginPath();
        ctx.moveTo(x - top, y - 460);
        ctx.lineTo(x + top, y - 460);
        ctx.lineTo(x + bottom, y - 10);
        ctx.lineTo(x - bottom, y - 10);
        ctx.closePath();
        ctx.fill();
      }
      // Where it lands: a warm pool round the sprout, fading out.
      const pool = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 96);
      pool.addColorStop(0, `rgba(255, 230, 140, ${0.34 * k})`);
      pool.addColorStop(1, 'rgba(255, 230, 140, 0)');
      ctx.fillStyle = pool;
      ctx.fillRect(x - 96, y - 106, 192, 192);
      ctx.restore();
    }
    for (const b of this.bolts) {
      b.t += dt;
      const fade = 1 - b.t / BOLT_TIME;
      ctx.save();
      ctx.lineJoin = 'miter';
      for (const [w, color, a] of [[10, '#8fd0ff', 0.35], [4, '#ffffff', 1]]) {
        ctx.globalAlpha = a * fade;
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        ctx.beginPath();
        b.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
      }
      ctx.restore();
    }
    this.bolts = this.bolts.filter((b) => b.t < BOLT_TIME);
  }

  /** Over the whole view (CSS pixels): the season's light, rain, breeze, flash. */
  screen(ctx, season, w, h, dt) {
    this.t += dt;
    ctx.save();
    if (season === 'summer') {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 226, 150, 0.16)';
      ctx.fillRect(0, 0, w, h);
    } else if (season === 'winter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(200, 224, 255)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(150, 200, 255, 0.13)';
      ctx.fillRect(0, 0, w, h);
    } else if (season === 'rainy') {
      ctx.fillStyle = 'rgba(24, 36, 58, 0.14)';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
    if (season === 'rainy' && !this.calm) this.rain(ctx, w, h, dt);
    if (season === 'spring' && !this.calm) this.breeze(ctx, w, h, dt);
    if (season === 'autumn' && !this.calm) this.fall(ctx, w, h, dt);
    if (this.flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(235, 245, 255, ${this.flash})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      this.flash = Math.max(0, this.flash - dt * 2.2);
    }
  }

  /** A light rain: a few thin drops, slanting down. */
  rain(ctx, w, h, dt) {
    const want = Math.round((w * h) / 9000);
    while (this.drops.length < want) {
      this.drops.push({ x: Math.random() * (w + 60), y: Math.random() * h, v: 480 + Math.random() * 160 });
    }
    this.drops.length = Math.min(this.drops.length, want);
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 214, 240, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.x -= d.v * 0.18 * dt;
      if (d.y > h + 12) { d.y = -12; d.x = Math.random() * (w + 60); }
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + 2.2, d.y - 12);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Autumn: a few leaves drifting down from the trees, swaying as they go. */
  fall(ctx, w, h, dt) {
    const want = Math.max(3, Math.round((w * h) / 90000));
    while (this.leaves.length < want) {
      this.leaves.push({
        x: Math.random() * w, y: -10 - Math.random() * h, v: 26 + Math.random() * 18, phase: Math.random() * 6,
        color: ['#d98a45', '#b8761a', '#9e2a22'][this.leaves.length % 3],
      });
    }
    ctx.save();
    for (const l of this.leaves) {
      l.y += l.v * dt;
      l.phase += dt * 1.6;
      if (l.y > h + 10) { l.y = -10; l.x = Math.random() * w; }
      const x = Math.round(l.x + Math.sin(l.phase) * 16);
      const y = Math.round(l.y);
      const tilt = Math.cos(l.phase) > 0;
      ctx.fillStyle = l.color;
      ctx.fillRect(x, y, 6, 3);
      ctx.fillRect(tilt ? x + 2 : x - 2, y + 3, 6, 2);
      ctx.fillStyle = 'rgba(43, 26, 12, 0.6)';
      ctx.fillRect(tilt ? x + 6 : x - 3, y + 1, 2, 1);
    }
    ctx.restore();
  }

  /** Spring: now and then a breeze blows across, with a few petals in it. */
  breeze(ctx, w, h, dt) {
    if (this.gust <= 0) {
      this.nextGust -= dt;
      if (this.nextGust > 0) return;
      this.gust = 2.6;
      this.nextGust = 5 + Math.random() * 4;
      this.streaks = Array.from({ length: 7 }, () => ({
        x: -160 - Math.random() * w * 0.6, y: h * (0.1 + Math.random() * 0.8), len: 70 + Math.random() * 90, phase: Math.random() * 6,
      }));
      this.petals = Array.from({ length: 6 }, () => ({
        x: -40 - Math.random() * w * 0.5, y: h * (0.15 + Math.random() * 0.7), phase: Math.random() * 6,
        color: Math.random() < 0.5 ? '#ffc8d2' : '#fff4e3',
      }));
    }
    this.gust = Math.max(0, this.gust - dt);
    const fade = Math.min(1, this.gust / 0.6, (2.6 - this.gust) / 0.4);
    const speed = w / 1.4;
    ctx.save();
    ctx.fillStyle = `rgba(255, 250, 235, ${0.32 * fade})`;
    for (const s of this.streaks) {
      s.x += speed * dt;
      for (let i = 0; i < s.len; i += 4) {
        const y = s.y + Math.sin((s.x + i) / 38 + s.phase) * 6;
        ctx.fillRect(Math.round(s.x + i), Math.round(y), 4, 2);
      }
    }
    for (const p of this.petals) {
      p.x += speed * 0.8 * dt;
      p.phase += dt * 5;
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y + Math.sin(p.phase) * 10), 4, 3);
    }
    ctx.restore();
  }
}

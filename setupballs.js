// Setup's backdrop (v25; until v24 it was the title's): faded dirtballs
// rolling straight across the page from any angle, the way a push sends them
// in the game. Two that meet break apart, like in the game.
import { BAC } from './sprites.js';

const AIM = 4;                   // balls rolling at once: when one rolls off or breaks, another sets off
const FADE = 0.2;                // how faint they are
const PACE = 2;                  // v25: twice as fast as they rolled behind the title
const MEET = 0.35;               // how often a ball comes down another's line, from the far end
const BREAK_TIME = 0.4;
const DIRT = ['#4a2f17', '#6b4423', '#8a5a2b'];

export function createSetupBalls(canvas, sheet) {
  const g = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let px = 4;                    // CSS pixels per art pixel
  let balls = [];
  let bits = [];
  let wait = 0;
  let still = false;             // reduced motion: a few balls, resting

  function fit() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === W && h === H) return;
    const dpr = Math.min(3, devicePixelRatio || 1);
    W = w;
    H = h;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    px = Math.max(3, Math.round(Math.min(w, h) / 110));
    balls = [];
    bits = [];
    still = false;               // a new size: the resting balls are laid out again
  }

  const size = () => 32 * px;
  const onPage = (b) => b.x > 0 && b.x < W && b.y > 0 && b.y < H;

  /** How far from `p` (on the page) along `d` the page ends, plus `margin`. */
  function reach(p, d, margin) {
    const across = d.x > 0 ? (W - p.x) / d.x : d.x < 0 ? -p.x / d.x : Infinity;
    const down = d.y > 0 ? (H - p.y) / d.y : d.y < 0 ? -p.y / d.y : Infinity;
    return Math.min(across, down) + margin;
  }

  /** A ball rolls in from just off the page, at any angle, on a line through
   *  somewhere on it. Now and then it comes down the line of one already
   *  rolling, from the far end, so the two meet. `progress` (0 to 1) starts
   *  it that far along its way (the first few, already rolling). */
  function launch(progress = 0) {
    const rolling = balls.filter((b) => !b.breaking && onPage(b));
    let way;
    let through;
    if (rolling.length && Math.random() < MEET) {
      const other = rolling[Math.floor(Math.random() * rolling.length)];
      const v = Math.hypot(other.vx, other.vy);
      way = { x: -other.vx / v, y: -other.vy / v };
      through = { x: other.x, y: other.y };
    } else {
      const a = Math.random() * Math.PI * 2;
      way = { x: Math.cos(a), y: Math.sin(a) };
      through = { x: (0.1 + Math.random() * 0.8) * W, y: (0.1 + Math.random() * 0.8) * H };
    }
    const margin = size() / 2;
    const behind = reach(through, { x: -way.x, y: -way.y }, margin);
    const ahead = reach(through, way, margin);
    const along = -behind + (behind + ahead) * progress;
    const speed = (14 + Math.random() * 16) * px * PACE;
    balls.push({
      x: through.x + way.x * along, y: through.y + way.y * along,
      vx: way.x * speed, vy: way.y * speed, t: Math.random() * 3, breaking: 0,
    });
  }

  function crumble(b) {
    b.breaking = 0.0001;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (20 + Math.random() * 30) * px;
      bits.push({
        x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 10 * px,
        life: 0, max: 0.5 + Math.random() * 0.3, color: DIRT[i % 3], size: px * (1 + (i % 2)),
      });
    }
  }

  function step(dt) {
    wait -= dt;
    // Faster balls cross sooner, so they're counted, not timed: the page
    // stays as full at any speed. A short wait spaces out the ones setting off.
    if (wait <= 0 && balls.filter((b) => !b.breaking).length < AIM) {
      launch();
      wait = 0.25 + Math.random() * 0.6;
    }
    const s = size();
    for (const b of balls) {
      b.t += dt;
      if (b.breaking) { b.breaking += dt; continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    // Two rolling balls that touch break, like two pushed dirtballs in the pot.
    const rolling = balls.filter((b) => !b.breaking);
    for (let i = 0; i < rolling.length; i++) {
      for (let j = i + 1; j < rolling.length; j++) {
        const a = rolling[i];
        const b = rolling[j];
        if (a.breaking || b.breaking) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < s * 0.5) { crumble(a); crumble(b); }
      }
    }
    balls = balls.filter((b) => (b.breaking ? b.breaking < BREAK_TIME
      : b.x > -s && b.x < W + s && b.y > -s && b.y < H + s));
    for (const p of bits) {
      p.life += dt;
      p.vy += 160 * px * dt / 4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    bits = bits.filter((p) => p.life < p.max);
  }

  function paint() {
    g.clearRect(0, 0, W, H);
    const s = size();
    g.globalAlpha = FADE;
    for (const b of balls) {
      const bob = b.breaking || still ? 0 : -Math.abs(Math.sin(b.t * 7 * PACE)) * px;
      const sy = b.breaking ? BAC.ballBreakY : BAC.ballY;
      const col = b.breaking ? Math.min(4, Math.floor((b.breaking / BREAK_TIME) * 5)) : 0;
      const x = Math.round((b.x - s / 2) / px) * px;
      const y = Math.round((b.y - s / 2 + bob) / px) * px;
      g.drawImage(sheet, col * 32, sy, 32, 32, x, y, s, s);
    }
    for (const p of bits) {
      g.globalAlpha = FADE * Math.max(0, 1 - p.life / p.max);
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x / px) * px, Math.round(p.y / px) * px, p.size, p.size);
    }
    g.globalAlpha = 1;
  }

  return {
    draw(dt, calm) {
      fit();
      if (!W || !H) return;
      if (calm) {
        // No motion: a few balls resting where they stopped.
        if (!still) {
          still = true;
          balls = [];
          for (let i = 0; i < 5; i++) launch(0.15 + i * 0.17);
        }
        paint();
        return;
      }
      still = false;
      if (!balls.length && !bits.length) {
        for (let i = 0; i < 4; i++) launch(0.15 + Math.random() * 0.7);
      }
      step(Math.min(dt, 0.05));
      paint();
    },
  };
}

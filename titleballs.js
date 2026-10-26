// The title page's backdrop: faded dirtballs rolling slowly across, straight
// along the way a push sends them in the game, from every side. Two that
// meet break apart, like in the game.
import { BAC } from './sprites.js';

const MOST = 7;                  // balls on screen at once, at most
const FADE = 0.2;                // how faint they are
const BREAK_TIME = 0.4;
const DIRT = ['#4a2f17', '#6b4423', '#8a5a2b'];
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];  // the way each side's balls roll

export function createTitleBalls(canvas, sheet) {
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
  }

  const size = () => 32 * px;

  /** A ball rolls in from one side. Now and then it comes down the lane of
   *  one already rolling, from the other end, so the two meet. */
  function launch(progress = 0) {
    const rolling = balls.filter((b) => !b.breaking);
    const speed = (14 + Math.random() * 16) * px;
    let dir;
    let lane;
    if (rolling.length && Math.random() < 0.35) {
      const other = rolling[Math.floor(Math.random() * rolling.length)];
      dir = [-other.vx / Math.hypot(other.vx, other.vy), -other.vy / Math.hypot(other.vx, other.vy)];
      lane = dir[0] ? other.y : other.x;
    } else {
      dir = SIDES[Math.floor(Math.random() * 4)];
      lane = (0.1 + Math.random() * 0.8) * (dir[0] ? H : W);
    }
    const s = size();
    const span = dir[0] ? W + s : H + s;
    const start = -s / 2 + span * progress;
    const x = dir[0] ? (dir[0] > 0 ? start : W - start) : lane;
    const y = dir[0] ? lane : (dir[1] > 0 ? start : H - start);
    balls.push({ x, y, vx: dir[0] * speed, vy: dir[1] * speed, t: Math.random() * 3, breaking: 0 });
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
    if (wait <= 0 && balls.filter((b) => !b.breaking).length < MOST) {
      launch();
      wait = 1 + Math.random() * 1.6;
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
      const bob = b.breaking || still ? 0 : -Math.abs(Math.sin(b.t * 7)) * px;
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

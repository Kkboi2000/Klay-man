// Draws a Game onto the canvas. Reads the game; never changes it.
import { SPRITE_SCALE as S, SHOT, POT_SCALE } from './config.js';
import { SOIL, WORLD, CAMERA_BOUNDS as BOUNDS, TREE_SPOT } from './world.js';
import { KLAY, BAC, TREE_ART } from './sprites.js';
import { BREAK_TIME, ABSORB_TIME } from './bacteria.js';
import { DIRTBALL_BREAK_TIME } from './dirtball.js';
import { ITEM_INFO } from './items.js';

const FONT = '"Pixelify Sans", ui-rounded, system-ui, sans-serif';
const DIRT = ['#4a2f17', '#6b4423', '#8a5a2b'];
const GERM = ['#3e7a4a', '#5aa266', '#2c5a35'];
const SPARK = ['#ffe9a8', '#ffd25a', '#ffffff'];

// The camera shows about this much of the world (in world units), so
// Klayman stays the same size whatever the screen.
const SEE = { w: 520, h: 420 };
const ZOOM = { min: 0.7, max: 1.7 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Renderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.time = 0;
    this.cam = { x: 0, y: 0, w: 1, h: 1 };
    this.snapCamera = true;
    this.calm = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    // Fit by area rather than width, so a tall phone gets a closer view.
    this.zoom = clamp(Math.sqrt((cssW * cssH) / (SEE.w * SEE.h)), ZOOM.min, ZOOM.max);
    this.cam.w = cssW / this.zoom;
    this.cam.h = cssH / this.zoom;
    this.snapCamera = true;
  }

  /** Follows Klayman (looking a little ahead, up the pot), within the pot. */
  follow(target, dt) {
    const cam = this.cam;
    const tx = target.x - cam.w / 2;
    const ty = target.y - cam.h * 0.58;
    const k = this.snapCamera ? 1 : 1 - Math.exp(-dt * 6);
    this.snapCamera = false;
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    const bw = BOUNDS.x1 - BOUNDS.x0;
    const bh = BOUNDS.y1 - BOUNDS.y0;
    cam.x = cam.w >= bw ? BOUNDS.x0 + (bw - cam.w) / 2 : clamp(cam.x, BOUNDS.x0, BOUNDS.x1 - cam.w);
    cam.y = cam.h >= bh ? BOUNDS.y0 + (bh - cam.h) / 2 : clamp(cam.y, BOUNDS.y0, BOUNDS.y1 - cam.h);
  }

  // ------------------------------------------------------------- effects

  handle(events) {
    for (const e of events) {
      switch (e.type) {
        case 'hit': this.burst(e.x, e.y - 12, 5, DIRT, 60); break;
        case 'dirtball': this.burst(e.x, e.y - 10, 8, DIRT, 80); break;
        case 'break': this.burst(e.x, e.y - 8, 10, DIRT, 110); break;
        case 'smash': this.burst(e.x, e.y - 8, 10, GERM, 120); break;
        case 'crack': this.burst(e.x, e.y - 10, 6, DIRT, 70); break;
        case 'spawn': this.burst(e.x, e.y, 5, DIRT, 40); break;
        case 'poison': this.burst(e.x, e.y - 22, 8, GERM, 50, -60); break;
        case 'treeHurt':
          this.burst(TREE_SPOT.x, TREE_SPOT.y - 30, 8, ['#6aa84f', '#3f7a2e'], 70);
          this.shake = 0.3;
          break;
        case 'score': this.popup(`+${e.points}`, e.x, e.y - 30); break;
        case 'pickup':
          this.burst(e.x, e.y - 18, 14, SPARK, 110);
          this.popup(ITEM_INFO[e.item].says, e.x, e.y - 44, 1.6);
          break;
        case 'itemAppears':
          this.burst(e.x, e.y - 18, 10, SPARK, 80);
          this.popup(ITEM_INFO[e.type].name, e.x, e.y - 48, 1.6);
          break;
      }
    }
  }

  burst(x, y, n, colors, speed, lift = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.6 + lift,
        life: 0,
        max: 0.35 + Math.random() * 0.35,
        color: colors[i % colors.length],
        size: 2 + Math.floor(Math.random() * 2) * 2,
        gravity: lift ? 0 : 260,
      });
    }
  }

  popup(text, x, y, max = 0.9) {
    this.popups.push({ text, x, y, life: 0, max });
  }

  // ---------------------------------------------------------------- draw

  draw(game, dt) {
    this.time += dt;
    const { ctx } = this;
    const s = this.zoom * this.dpr;
    this.follow(game.klay, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#636363';    // the gray around the pot in bg.png
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      if (!this.calm) {
        const a = this.shake * 14;
        sx = (Math.random() * 2 - 1) * a;
        sy = (Math.random() * 2 - 1) * a;
      }
    }
    // Snap the camera to whole device pixels so sprites don't shimmer.
    const ox = Math.round((-this.cam.x + sx) * s);
    const oy = Math.round((-this.cam.y + sy) * s);
    ctx.setTransform(s, 0, 0, s, ox, oy);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const bg = this.sprites.bg;
    ctx.drawImage(bg, 0, 0, bg.width * POT_SCALE, bg.height * POT_SCALE);
    ctx.imageSmoothingEnabled = false;

    const things = [];
    things.push({ y: TREE_SPOT.y, draw: () => this.drawTree(game) });
    for (const b of game.bacteria) things.push({ y: b.y, draw: () => this.drawBacteria(b, game.frozen) });
    for (const d of game.dirtballs) things.push({ y: d.y, draw: () => this.drawDirtball(d, game.frozen) });
    if (game.item) things.push({ y: game.item.y, draw: () => this.drawItem(game.item) });
    for (const shot of game.shots) things.push({ y: shot.y, draw: () => this.drawShot(shot) });
    things.push({ y: game.klay.y, draw: () => this.drawKlayman(game) });
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();

    if (game.frozen) this.drawFrost(game.freeze);
    this.drawParticles(dt);
    this.drawPopups(dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawMarkers(game);
  }

  // ------------------------------------------------- off-screen pointers

  /** Arrows at the screen edge pointing at things the camera can't see. */
  drawMarkers(game) {
    const marks = [];
    for (const b of game.bacteria) {
      if (b.crawling) marks.push({ x: b.x, y: b.y - 12, color: '#5aa266', size: 7 });
    }
    if (game.item && !(game.item.blinking && Math.floor(game.item.t * 8) % 2 === 0)) {
      marks.push({ x: game.item.x, y: game.item.y - 16, color: '#ffd25a', size: 10, icon: game.item.type });
    }
    if (!game.over) marks.push({ x: TREE_SPOT.x, y: TREE_SPOT.y - 30, color: '#8cc152', size: 10, icon: 'heart' });

    const { ctx } = this;
    const W = this.cssW;
    const H = this.cssH;
    const top = 56;               // keep clear of the score bar
    const pad = 16;
    const cx = W / 2;
    const cy = (H + top) / 2;
    for (const m of marks) {
      const px = (m.x - this.cam.x) * this.zoom;
      const py = (m.y - this.cam.y) * this.zoom;
      if (px > -4 && px < W + 4 && py > -4 && py < H + 4) continue;
      const dx = px - cx;
      const dy = py - cy;
      const halfW = W / 2 - pad;
      const halfH = (H - top) / 2 - pad;
      const t = Math.min(halfW / Math.abs(dx || 1e-6), halfH / Math.abs(dy || 1e-6));
      const x = cx + dx * t;
      const y = cy + dy * t;
      const a = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(x, y);
      if (m.icon) {
        const icon = m.icon === 'heart' ? this.sprites.heart : this.sprites.icons[m.icon];
        const size = m.icon === 'heart' ? 14 : 18;
        ctx.drawImage(icon, -Math.cos(a) * 14 - size / 2, -Math.sin(a) * 14 - size / 2, size, (size * icon.height) / icon.width);
      }
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(m.size, 0);
      ctx.lineTo(-m.size * 0.7, -m.size * 0.8);
      ctx.lineTo(-m.size * 0.7, m.size * 0.8);
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2b1a0c';
      ctx.stroke();
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.restore();
    }
  }

  sprite(img, sx, sy, sw, sh, x, y, ax, ay, { flip = false, scale = S, alpha = 1 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -ax * scale, -ay * scale, sw * scale, sh * scale);
    ctx.restore();
  }

  shadow(x, y, w, alpha = 0.28) {
    const { ctx } = this;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTree(game) {
    const sp = this.sprites;
    const frame = Math.floor(this.time * 1.6) % 2;
    const scale = S * game.treeScale;
    const { x, y } = TREE_SPOT;
    const a = TREE_ART.anchor;
    if (game.over) {
      this.sprite(sp.treeWilted, frame * 32, 0, 32, 48, x, y, a.x, a.y, { scale: scale * 0.9 });
      return;
    }
    this.sprite(sp.tree, frame * 32, 0, 32, 48, x, y, a.x, a.y, { scale });
    if (game.treeHurt > 0) {
      this.sprite(sp.treeHurt, frame * 32, 0, 32, 48, x, y, a.x, a.y, { scale, alpha: game.treeHurt / 0.5 });
    }
  }

  drawBacteria(b, frozen) {
    const sp = this.sprites;
    const sheet = frozen && b.alive ? sp.bacFrozen : sp.bac;
    const a = BAC.anchor;

    if (b.state === 'breaking') {
      const f = Math.min(4, Math.floor((b.fx / BREAK_TIME) * 5));
      this.sprite(sp.bac, f * 32, BAC.splatY, 32, 32, b.x, b.y, a.x, a.y);
      return;
    }
    if (b.state === 'absorbed') {
      const k = 1 - Math.min(1, b.fx / ABSORB_TIME);
      this.sprite(sp.bac, 0, 0, 32, 32, b.x, b.y, a.x, a.y, { scale: S * k, alpha: k });
      return;
    }
    this.shadow(b.x, b.y, 11);
    const rise = Math.min(1, b.t / 0.35);
    const frame = Math.floor(b.t * 6) % 4;
    this.sprite(sheet, frame * 32, BAC.crawlY(b.look), 32, 32, b.x, b.y, a.x, a.y, {
      scale: S * (0.5 + rise * 0.5),
      alpha: rise,
    });
  }

  drawDirtball(d, frozen) {
    const sp = this.sprites;
    const a = BAC.anchor;
    if (d.state === 'breaking') {
      const f = Math.min(4, Math.floor((d.fx / DIRTBALL_BREAK_TIME) * 5));
      this.sprite(sp.bac, f * 32, BAC.ballBreakY, 32, 32, d.x, d.y, a.x, a.y);
      return;
    }
    this.shadow(d.x, d.y, 13);
    let jx = 0, jy = 0;
    if (d.state === 'idle' && d.hold < 2 && !frozen) {
      jx = Math.sin(this.time * 45) * (2 - d.hold); // about to crack
    } else if (d.state === 'rolling') {
      jy = -Math.abs(Math.sin(this.time * 30)) * 2;
    }
    this.sprite(sp.bac, 0, BAC.ballY, 32, 32, d.x + jx, d.y + jy, a.x, a.y);
  }

  drawItem(item) {
    if (item.blinking && Math.floor(item.t * 8) % 2 === 0) return;
    const pop = Math.min(1, item.t / 0.25);
    const bob = Math.sin(item.t * 3) * 3;
    this.shadow(item.x, item.y, 10 * pop, 0.3);
    this.sprite(this.sprites.icons[item.type], 0, 0, 16, 16, item.x, item.y - 16 + bob, 8, 8, {
      scale: S * pop,
    });
  }

  drawShot(shot) {
    this.shadow(shot.x, shot.y, 4, 0.25);
    const r = KLAY.shot;
    this.sprite(this.sprites.klay, r.x, r.y, r.w, r.h, shot.x, shot.y - SHOT.height, r.w / 2, r.h / 2);
  }

  drawKlayman(game) {
    const k = game.klay;
    const sp = this.sprites;
    let kind = k.moving ? 'walk' : 'idle';
    if (k.action) kind = k.action.kind;
    const clock = kind === 'idle' ? this.time : k.t;
    const { col, row } = KLAY.frame(kind, k.facing, clock, k.action ? k.action.t : 0);
    const size = KLAY.size;
    const a = KLAY.anchor;
    const flip = k.facing === 'side' && k.flip;
    const jitter = k.stun > 0 && !this.calm ? Math.sin(this.time * 70) * 1.5 : 0;

    if (game.boost > 0) {
      const pulse = 0.25 + 0.12 * Math.sin(this.time * 10);
      const { ctx } = this;
      ctx.fillStyle = `rgba(255,214,90,${pulse})`;
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (Math.random() < 0.15) this.burst(k.x, k.y - 20, 1, SPARK, 30, -40);
    }

    this.sprite(sp.klay, col * size, row * size, size, size, k.x + jitter, k.y, a.x, a.y, { flip });
    const green = k.greenness;
    if (green > 0) {
      this.sprite(sp.klayGreen, col * size, row * size, size, size, k.x + jitter, k.y, a.x, a.y, {
        flip,
        alpha: green * 0.55, // "turn green a bit"
      });
    }
  }

  drawFrost(left) {
    const { ctx } = this;
    const fade = Math.min(1, left / 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(SOIL.cx, SOIL.cy, SOIL.rx, SOIL.ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = `rgba(160,215,255,${0.13 * fade})`;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.restore();
  }

  drawParticles(dt) {
    const { ctx } = this;
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  drawPopups(dt) {
    const { ctx } = this;
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of this.popups) {
      p.life += dt;
      const k = p.life / p.max;
      const y = p.y - k * 26;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#24190d';
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = '#fff4e3';
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter((p) => p.life < p.max);
  }
}

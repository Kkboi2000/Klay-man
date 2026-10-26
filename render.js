// Draws a Game onto the canvas. Reads the game; never changes it.
// With the glasses on, it also draws what they show, all in one light blue:
// arrows to bacteria and items, an item's seconds left, and where the next
// bacteria or item is about to appear.
import { SPRITE_SCALE as S, SHOT, POT_SCALE, COINS, KLAYMAN, LOOKAHEAD, ITEM_FLIGHT } from './config.js';
import { SOIL, WORLD, CAMERA_BOUNDS as BOUNDS, TREE_SPOT, RING_SQUASH } from './world.js';
import { KLAY, BAC, TREE_ART } from './sprites.js';
import { BREAK_TIME, ABSORB_TIME } from './bacteria.js';
import { DIRTBALL_BREAK_TIME } from './dirtball.js';
import { ITEM_INFO } from './items.js';

const FONT = '"Klay Digits", "Pixelify Sans", ui-rounded, system-ui, sans-serif';
const DIRT = ['#4a2f17', '#6b4423', '#8a5a2b'];
const GERM = ['#3e7a4a', '#5aa266', '#2c5a35'];
const SPARK = ['#ffe9a8', '#ffd25a', '#ffffff'];
const SPORE = ['#b06ed6', '#d9a6f0', '#7a3fa0'];
const PETAL = ['#ff8593', '#d8263d', '#ffffff'];
const GOLD = '#ffd25a';
const LEAF = ['#668543', '#54762f', '#cfe39a'];
const LILY = ['#fff4e3', '#efe0c4', '#ff8593'];
const COAT = ['#eef2f5', '#9fb4c4'];
const ROLL = 0.5;                 // seconds a corn or lily takes to close up or open
const VISOR = '#7fdcff';          // everything the glasses show
const VISOR_INK = '#0c2b3a';

// The camera shows about this much of the world (in world units), so
// Klayman stays the same size whatever the screen.
const SEE = { w: 520, h: 420 };
const ZOOM = { min: 0.7, max: 1.7 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Renderer {
  /** `zoom` fixes the zoom (the setup page's close-up); `markers` draws the
   *  arrows to things off-screen; `smallGun` draws the game-sized dirt gun. */
  constructor(canvas, sprites, { zoom = null, markers = true, smallGun = true } = {}) {
    this.canvas = canvas;
    this.fixedZoom = zoom;
    this.markers = markers;
    this.smallGun = smallGun;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.clearEffects();
    this.time = 0;
    this.cam = { x: 0, y: 0, w: 1, h: 1 };
    this.snapCamera = true;
    this.calm = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Forgets every effect in flight: a new game, or a new look on the setup page. */
  clearEffects() {
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.floaters = [];            // hearts rising from the sprout
    this.sparkles = [];            // a sunflower's bling
    this.bloom = 0;                // seconds the sunflower stays lit up
    this.kick = 0;                 // seconds the corn still shudders from closing
    this.shake = 0;
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
    this.zoom = this.fixedZoom ?? clamp(Math.sqrt((cssW * cssH) / (SEE.w * SEE.h)), ZOOM.min, ZOOM.max);
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
    const top = { x: TREE_SPOT.x, y: TREE_SPOT.y - 40 };
    for (const e of events) {
      switch (e.type) {
        case 'hit': this.burst(e.x, e.y - 12, 5, DIRT, 60); break;
        case 'dirtball': this.burst(e.x, e.y - 10, 8, DIRT, 80); break;
        case 'break': this.burst(e.x, e.y - 8, 10, DIRT, 110); break;
        case 'smash': this.burst(e.x, e.y - 8, 10, GERM, 120); break;
        case 'crack': this.burst(e.x, e.y - 10, 6, DIRT, 70); break;
        case 'spawn': this.burst(e.x, e.y, 5, DIRT, 40); break;
        case 'poison': this.burst(e.x, e.y - 22, 8, GERM, 50, -60); break;
        case 'slowed': this.burst(e.x, e.y - 14, 6, COAT, 50, -30); break;
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
          if (e.from) {
            this.bling(e.from.x, e.from.y);
          } else {
            this.burst(e.x, e.y - 18, 10, SPARK, 80);
          }
          this.popup(ITEM_INFO[e.item].name, e.x, e.y - 48, 1.6);
          break;
        case 'coinAppears': this.burst(e.x, e.y - 12, e.value > 1 ? 10 : 5, SPARK, 60); break;
        case 'coin':
          this.burst(e.x, e.y - 14, 8, SPARK, 90);
          this.popup(`+${e.value}K`, e.x, e.y - 36, 0.9, GOLD);
          break;
        case 'heal':
          // A rose (or a mushroom's half heart): a pink wash, petals, and a heart floating up.
          this.ring(TREE_SPOT.x, TREE_SPOT.y - 6, 90, 0.6, '#ff8593', '#ffd6dc');
          this.burst(top.x, top.y, 26, PETAL, 120, -70);
          this.floatHeart(top.x, top.y - 20, e.amount < 1 ? 'half' : 'full');
          break;
        case 'grow':
          this.burst(top.x, top.y, 14, SPORE, 90, -40);
          this.popup('+1 heart', TREE_SPOT.x, TREE_SPOT.y - 80, 1.4);
          break;
        case 'spores':
          this.ring(e.x, e.y - 6, e.reach, 0.7, '#b06ed6', '#f0d4ff');
          this.burst(e.x, e.y - 30, 18, SPORE, 160, -20);
          break;
        case 'shield':
          // Corn snaps its leaves shut: a shudder, a green ring, leaves flying.
          this.kick = 0.45;
          this.ring(TREE_SPOT.x, TREE_SPOT.y - 6, 110, 0.5, '#54762f', '#cfe39a');
          this.burst(top.x + 8, top.y - 10, 26, LEAF, 140, -40);
          this.burst(top.x + 8, top.y - 30, 10, LEAF, 60, -70);
          break;
        case 'unshield': this.burst(top.x + 8, top.y - 10, 16, LEAF, 100, -50); break;
        case 'hide': this.burst(top.x, top.y - 30, 8, LILY, 40, -20); break;
        case 'unhide': this.burst(top.x, top.y - 34, 12, LILY, 70, -40); break;
        case 'revive':
        case 'backup':
          this.ring(e.x, e.y - 6, e.reach, 0.8, GOLD, '#fff2b8');
          this.burst(top.x, top.y, 24, e.type === 'revive' ? PETAL : LEAF, 130, -60);
          this.floatHeart(top.x, top.y - 20, 'full');
          break;
      }
    }
  }

  /** A sunflower lights up and twinkles as an item jumps out of it. */
  bling(x, y) {
    this.bloom = 0.55;
    this.burst(x, y, 12, SPARK, 90, -50);
    const spots = [[-22, -10, 0], [18, -18, 0.06], [-8, -30, 0.12], [26, 6, 0.18], [-28, 12, 0.24], [6, -40, 0.3], [0, 0, 0.02]];
    for (const [dx, dy, delay] of spots) {
      this.sparkles.push({ x: x + dx, y: y + dy, t: -delay, max: 0.45, size: dx === 0 && dy === 0 ? 10 : 6 });
    }
  }

  floatHeart(x, y, kind) {
    const img = kind === 'half' ? this.sprites.halfHeart : this.sprites.heart;
    this.floaters.push({ img, x, y, t: 0, max: 1.3 });
  }

  ring(x, y, reach, max, color, light) {
    this.rings.push({ x, y, reach, t: 0, max, color, light });
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

  popup(text, x, y, max = 0.9, color = '#fff4e3') {
    this.popups.push({ text, x, y, life: 0, max, color });
  }

  // ---------------------------------------------------------------- draw

  /** Draws the pot, with the camera on `focus` (Klayman, unless told otherwise). */
  draw(game, dt, focus = game.klay) {
    this.time += dt;
    if (this.bloom > 0) this.bloom = Math.max(0, this.bloom - dt);
    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt);
    const { ctx } = this;
    const s = this.zoom * this.dpr;
    this.follow(focus, dt);
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
    for (const c of game.coins) things.push({ y: c.y, draw: () => this.drawCoin(c) });
    for (const d of game.dirtballs) things.push({ y: d.y, draw: () => this.drawDirtball(d, game.frozen) });
    if (game.item) things.push({ y: game.item.y, draw: () => this.drawItem(game.item) });
    for (const shot of game.shots) things.push({ y: shot.y, draw: () => this.drawShot(shot) });
    things.push({ y: game.klay.y, draw: () => this.drawKlayman(game) });
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();
    if (game.lock?.alive && !game.over) this.drawLock(game.lock);

    if (game.frozen) this.drawFrost(game.freeze);
    if (game.gear.glasses && !game.over) this.drawGuides(game);
    this.drawRings(dt);
    this.drawParticles(dt);
    this.drawSparkles(dt);
    this.drawFloaters(dt);
    this.drawPopups(dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.markers) this.drawMarkers(game);
  }

  // ------------------------------------------------- off-screen pointers

  /** Arrows at the screen edge pointing at things the camera can't see:
   *  the sprout always; bacteria, items and coins only through the glasses. */
  drawMarkers(game) {
    const marks = [];
    if (game.gear.glasses) {
      for (const b of game.bacteria) {
        if (b.crawling) marks.push({ x: b.x, y: b.y - 12, color: '#5aa266', size: 7 });
      }
      const item = game.item;
      if (item && !(item.blinking && Math.floor(item.t * 8) % 2 === 0)) {
        marks.push({ x: item.x, y: item.y - 16, color: GOLD, size: 10, icon: item.type, secs: item.landed ? Math.ceil(item.life) : null });
      }
      for (const c of game.coins) {
        if (c.blinking && Math.floor(c.t * 10) % 2 === 0) continue;
        marks.push({ x: c.x, y: c.y - 12, color: GOLD, size: 8, icon: 'coin', secs: Math.ceil(c.life) });
      }
    }
    if (!game.over) marks.push({ x: TREE_SPOT.x, y: TREE_SPOT.y - 30, color: '#8cc152', size: 10, icon: 'heart' });

    const { ctx } = this;
    const W = this.cssW;
    const H = this.cssH;
    const top = 80;               // keep clear of the score and coins
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
        const icon = m.icon === 'heart' ? this.sprites.heart
          : m.icon === 'coin' ? this.sprites.coin : this.sprites.icons[m.icon];
        const size = m.icon === 'heart' || m.icon === 'coin' ? 14 : 18;
        ctx.drawImage(icon, -Math.cos(a) * 14 - size / 2, -Math.sin(a) * 14 - size / 2, size, (size * icon.height) / icon.width);
        if (m.secs !== null && m.secs !== undefined) {
          this.label(String(m.secs), -Math.cos(a) * 34, -Math.sin(a) * 34, 13);
        }
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
    const sprout = this.sprites.sprouts[game.gear.sprout];
    const frame = Math.floor(this.time * 1.6) % 2;
    let scale = S * game.treeScale;
    const { x, y } = TREE_SPOT;
    const a = TREE_ART.anchor;
    if (game.over) {
      this.sprite(sprout.wilted, frame * 32, 0, 32, 48, x, y, a.x, a.y, { scale: scale * 0.9 });
      return;
    }
    const look = this.closingLook(game, sprout);
    // A mushroom about to release its spores swells a little.
    if (game.gear.spores && game.sporeTimer < 0.8 && !this.calm) {
      scale *= 1 + 0.06 * Math.abs(Math.sin(this.time * 18));
    }
    // Corn shudders as its leaves snap shut.
    const sx = this.kick > 0 && !this.calm ? Math.round(Math.sin(this.time * 60) * this.kick * 6) : 0;
    this.sprite(look.sheet, frame * 32, 0, 32, 48, x + sx, y, a.x, a.y, { scale });
    if (this.bloom > 0) {
      const flash = this.calm ? 0.5 : 0.35 + 0.35 * Math.abs(Math.sin(this.time * 24));
      this.sprite(look.glow, frame * 32, 0, 32, 48, x, y, a.x, a.y, { scale, alpha: flash * Math.min(1, this.bloom / 0.3) });
    }
    if (game.treeHurt > 0) {
      this.sprite(look.hurt, frame * 32, 0, 32, 48, x, y, a.x, a.y, { scale, alpha: game.treeHurt / 0.5 });
    }
  }

  /** Corn and lilies close up step by step over ROLL seconds, and open the
   *  same way back: a lily's petals curl up into a bud and unroll again. */
  closingLook(game, sprout) {
    const steps = sprout.steps;
    const g = game.gear;
    const power = g.shield ?? g.hide;
    const left = g.shield ? game.shield : g.hide ? game.hidden : 0;
    if (!steps || !power || left <= 0) return sprout;
    const p = this.calm ? 1 : Math.min(1, (power.time - left) / ROLL, left / ROLL);
    return steps[Math.round(p * (steps.length - 1))];
  }

  drawBacteria(b, frozen) {
    const sp = this.sprites;
    let sheet = sp.bac;
    if (frozen && b.alive) sheet = sp.bacFrozen;
    else if (b.slowed && b.crawling) sheet = sp.bacSlow;
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
    const img = this.sprites.icons[item.type];
    if (!item.landed) {
      // Out of a sunflower: a hop up and over, landing where it will wait.
      const p = 1 - item.flight / ITEM_FLIGHT;
      const x = item.from.x + (item.x - item.from.x) * p;
      const y = item.from.y + (item.y - 16 - item.from.y) * p - 4 * 34 * p * (1 - p);
      const groundY = TREE_SPOT.y + (item.y - TREE_SPOT.y) * p;
      this.shadow(x, groundY, 10 * p, 0.3 * p);
      this.sprite(img, 0, 0, 16, 16, x, y, 8, 8, { scale: S * (0.6 + 0.4 * p) });
      return;
    }
    const pop = Math.min(1, item.t / 0.25);
    const bob = Math.sin(item.t * 3) * 3;
    this.shadow(item.x, item.y, 10 * pop, 0.3);
    this.sprite(img, 0, 0, 16, 16, item.x, item.y - 16 + bob, 8, 8, {
      scale: S * pop,
    });
  }

  drawShot(shot) {
    this.shadow(shot.x, shot.y, 4, 0.25);
    const r = KLAY.shot;
    if (shot.gun) {
      // A dirt gun pellet leaves a short streak.
      const { ctx } = this;
      const v = Math.hypot(shot.vx, shot.vy) || 1;
      ctx.fillStyle = 'rgba(138, 90, 43, 0.45)';
      for (let i = 1; i <= 3; i++) {
        const k = (i * 5) / v;
        ctx.fillRect(Math.round(shot.x - shot.vx * k) - 2, Math.round(shot.y - SHOT.height - shot.vy * k) - 2, 4, 4);
      }
    }
    this.sprite(this.sprites.klay, r.x, r.y, r.w, r.h, shot.x, shot.y - SHOT.height, r.w / 2, r.h / 2);
  }

  drawCoin(c) {
    if (c.blinking && Math.floor(c.t * 10) % 2 === 0) return;
    const { ctx } = this;
    const pop = Math.min(1, c.t / 0.2);
    const big = c.value >= COINS.dropValue ? 1.4 : 1;
    const bob = Math.sin(c.t * 5) * 2;
    const spin = this.calm ? 1 : 0.5 + 0.5 * Math.abs(Math.cos(c.t * 2.4)); // turns, never edge-on
    const img = this.sprites.coin;
    const w = img.width * S * big * pop;
    const h = img.height * S * big * pop;
    this.shadow(c.x, c.y, 8 * big * pop, 0.3);
    ctx.save();
    ctx.translate(Math.round(c.x), Math.round(c.y - 14 * big + bob));
    ctx.scale(spin, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    if (big > 1 && Math.random() < 0.08) this.burst(c.x, c.y - 20, 1, SPARK, 20, -30);
  }

  drawKlayman(game) {
    const k = game.klay;
    const sp = this.sprites;
    const tools = game.gear.tools;
    const hasGun = tools.includes('gun');
    const look = sp.lookFor(tools);
    // With the dirt gun he doesn't wind up a throw: he aims and fires.
    let kind = k.moving ? 'walk' : 'idle';
    if (k.action && !(hasGun && k.action.kind === 'attack')) kind = k.action.kind;
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

    const gun = hasGun ? () => this.drawGun(k, row, col, flip, jitter) : null;
    if (gun && k.facing === 'back') gun();      // held up the pot, behind him
    this.sprite(look.sheet, col * size, row * size, size, size, k.x + jitter, k.y, a.x, a.y, { flip });
    const green = k.greenness;
    if (green > 0) {
      this.sprite(look.green, col * size, row * size, size, size, k.x + jitter, k.y, a.x, a.y, {
        flip,
        alpha: green * 0.55, // "turn green a bit"
      });
    }
    if (gun && k.facing !== 'back') gun();
    if (tools.includes('gloves') && k.action?.kind === 'attack') this.drawWind(k);
  }

  /** The dirt gun in Klayman's front hand, with a kick and a flash on each shot.
   *  In the game it's the small one, with a small flash; the setup page shows the big one. */
  drawGun(k, row, col, flip, jitter) {
    const art = (this.smallGun ? this.sprites.gunSmall : this.sprites.gun)[k.facing];
    const flash = this.smallGun ? 4 : 8;
    const hand = this.sprites.gunSpots[row][col];
    const firing = k.action?.kind === 'attack' ? k.action.t : Infinity;
    const kick = firing < 0.1 ? 1 : 0;
    const back = { side: [-kick, 0], front: [0, -kick], back: [0, kick] }[k.facing];
    const gx = hand.x - art.grip.x + back[0] - KLAY.anchor.x;
    const gy = hand.y - art.grip.y + back[1] - KLAY.anchor.y;
    const { ctx } = this;
    ctx.save();
    ctx.translate(Math.round(k.x + jitter), Math.round(k.y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(art.img, gx * S, gy * S, art.img.width * S, art.img.height * S);
    if (firing < 0.07) {
      const out = { side: [1, 0], front: [0, 1], back: [0, -1] }[k.facing];
      const mx = (gx + art.muzzle.x + out[0] * 1.5) * S + out[0] * (flash / 2 - 1);
      const my = (gy + art.muzzle.y + out[1] * 1.5) * S + out[1] * (flash / 2 - 1);
      ctx.fillStyle = GOLD;
      ctx.fillRect(mx - flash / 2, my - flash / 2, flash, flash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - flash / 4, my - flash / 4, flash / 2, flash / 2);
    }
    ctx.restore();
  }

  /** The dirt gun's lock: four corner brackets round the closest bacteria. */
  drawLock(b) {
    const { ctx } = this;
    const pulse = this.calm ? 0 : Math.round(Math.sin(this.time * 9) * 2);
    const r = 19 + pulse;
    const arm = 7;
    const x = Math.round(b.x);
    const y = Math.round(b.y - 12);
    ctx.save();
    for (const [w, color] of [[6, '#2b1a0c'], [3, '#ff5a4a']]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.lineCap = 'square';
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(x + sx * r, y + sy * (r - arm));
        ctx.lineTo(x + sx * r, y + sy * r);
        ctx.lineTo(x + sx * (r - arm), y + sy * r);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Gloves: three short pixel streaks shoot off the way the dirt flies.
   *  Every speck sits on the art's 2-unit pixel grid. */
  drawWind(k) {
    const p = Math.min(1, k.action.t / KLAYMAN.actionTime);
    const turn = { side: 0, front: Math.PI / 2, back: -Math.PI / 2 }[k.facing];
    const { ctx } = this;
    const dot = (x, y) => ctx.fillRect(Math.round(x / 2) * 2 - 1, Math.round(y / 2) * 2 - 1, 2, 2);
    ctx.save();
    ctx.translate(Math.round(k.x), Math.round(k.y - 18));
    if (k.facing === 'side' && k.flip) ctx.scale(-1, 1);
    ctx.rotate(turn);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = Math.ceil((1 - p * 0.9) * 4) / 4;   // fades in steps, not smoothly
    for (const [lane, len] of [[-7, 8], [0, 14], [7, 8]]) {
      const from = 12 + p * 34;
      for (let d = 0; d < len * (1 - p * 0.5); d += 2) dot(from + d, lane);
    }
    ctx.restore();
  }

  /** A ring rolling out across the soil (spores, a heal, a revived sprout).
   *  Its edge is where its push stops. */
  drawRings(dt) {
    const { ctx } = this;
    for (const r of this.rings) {
      r.t += dt;
      const k = r.t / r.max;
      const radius = 30 + k * (r.reach - 30);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.lineWidth = 6;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, radius, radius * RING_SQUASH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = r.light;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, radius * 0.92, radius * RING_SQUASH * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.rings = this.rings.filter((r) => r.t < r.max);
  }

  /** Four-point stars that grow and shrink: the sunflower's bling. */
  drawSparkles(dt) {
    const { ctx } = this;
    for (const s of this.sparkles) {
      s.t += dt;
      if (s.t < 0) continue;
      const k = s.t / s.max;
      const arm = Math.round((s.size * Math.sin(Math.PI * Math.min(1, k))) / 2) * 2;
      const x = Math.round(s.x / 2) * 2;
      const y = Math.round(s.y / 2) * 2;
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - arm, y - 1, arm * 2 + 2, 2);
      ctx.fillRect(x, y - arm - 1, 2, arm * 2 + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 2, 4, 4);
    }
    this.sparkles = this.sparkles.filter((s) => s.t < s.max);
  }

  /** Hearts drifting up from the sprout and fading. */
  drawFloaters(dt) {
    for (const f of this.floaters) {
      f.t += dt;
      const k = f.t / f.max;
      const lift = Math.round((1 - (1 - k) ** 2) * 36);
      const alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const img = f.img;
      this.sprite(img, 0, 0, img.width, img.height, f.x, f.y - lift, img.width / 2, img.height / 2, {
        scale: S * 1.5, alpha: Math.max(0, alpha),
      });
    }
    this.floaters = this.floaters.filter((f) => f.t < f.max);
  }

  // ------------------------------------------------------------- glasses

  /** What the glasses add to the pot: where the next bacteria, item and 1K
   *  coin will appear (up to 3 seconds ahead, with a picture of which item),
   *  and how long the item and coins on the ground will wait. */
  drawGuides(game) {
    game.upcoming.forEach((p, i) => {
      this.target(p, 1 - Math.min(1, game.untilUpcoming(i) / LOOKAHEAD), null);
    });
    if (game.nextItem) {
      const k = 1 - Math.min(1, game.itemTimer / LOOKAHEAD);
      this.target(game.nextItem, k, this.sprites.icons[game.nextItem.type]);
    }
    if (game.nextCoin) {
      const k = 1 - Math.min(1, game.coinTimer / LOOKAHEAD);
      this.target(game.nextCoin, k, this.sprites.coin);
    }
    const item = game.item;
    if (item?.landed && !(item.blinking && Math.floor(item.t * 8) % 2 === 0)) {
      this.label(String(Math.ceil(item.life)), item.x, item.y - 46, 13);
    }
    for (const c of game.coins) {
      if (c.blinking && Math.floor(c.t * 10) % 2 === 0) continue;
      const big = c.value >= COINS.dropValue;
      this.label(String(Math.ceil(c.life)), c.x, c.y - (big ? 44 : 34), 12);
    }
  }

  /** A dotted ring on the soil that closes in as the moment comes, with a
   *  see-through `picture` of what's coming (an item, a coin) in the middle,
   *  or a dot for a bacteria. */
  target(p, k, picture) {
    const { ctx } = this;
    const r = Math.round(26 - 12 * k);
    const blink = !this.calm && k > 0.8 && Math.floor(this.time * 14) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 0.9;
    for (const [color, grow] of [[VISOR_INK, 2], [VISOR, 0]]) {
      ctx.fillStyle = color;
      const size = 2 + grow;
      const n = 16;
      for (let i = 0; i < n; i++) {
        if (i % 4 === 3) continue;               // gaps, like a sight
        const a = (i / n) * Math.PI * 2 + this.time * 1.5;
        const x = Math.round((p.x + Math.cos(a) * r) / 2) * 2;
        const y = Math.round((p.y + Math.sin(a) * r * RING_SQUASH) / 2) * 2;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      const cx = Math.round(p.x / 2) * 2;
      const cy = Math.round(p.y / 2) * 2;
      if (!picture) ctx.fillRect(cx - size / 2 - 1, cy - size / 2 - 1, size + 2, size + 2);
    }
    ctx.restore();
    if (picture) {
      const bob = this.calm ? 0 : Math.round(Math.sin(this.time * 4) * 2);
      const { width: w, height: h } = picture;
      this.sprite(picture, 0, 0, w, h, p.x, p.y - 14 + bob, w / 2, h / 2, {
        alpha: blink ? 0.3 : 0.55 + 0.3 * k,
      });
    }
  }

  /** A number in the glasses' blue. */
  label(text, x, y, px) {
    const { ctx } = this;
    ctx.save();
    ctx.font = `700 ${px}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = VISOR_INK;
    ctx.strokeText(text, Math.round(x), Math.round(y));
    ctx.fillStyle = VISOR;
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
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
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter((p) => p.life < p.max);
  }
}

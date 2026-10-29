// Draws a Game onto the canvas. Reads the game; never changes it.
// With the glasses on, it also draws what they show, all in one light blue:
// arrows to bacteria, the boss, items and coins, seconds left on items and
// coins, where the next bacteria, item, coin or boss is about to appear, and
// the boss's HP.
import { SPRITE_SCALE as S, SHOT, POT_SCALE, COINS, KLAYMAN, LOOKAHEAD, ITEM_FLIGHT, BOSS } from './config.js';
import { SOIL, WORLD, CAMERA_BOUNDS as BOUNDS, TREE_SPOT, RING_SQUASH } from './world.js';
import { KLAY, BAC, TREE_ART, BOSS_ART } from './sprites.js';
import { BREAK_TIME, ABSORB_TIME } from './bacteria.js';
import { DIRTBALL_BREAK_TIME } from './dirtball.js';
import { ITEM_INFO } from './items.js';
import { Weather } from './weather.js';

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
const MIST = ['#d4f0ff', '#ffffff', '#8fe3ff'];
const FEED = ['#8a5a2b', '#6b4423', '#cfe39a', '#6aa84f'];
const SWEAT = ['#8fe3ff', '#d4f0ff'];
const HP = { full: '#6aa84f', half: '#ffd25a', low: '#d9483b' };
const LEAF_SPIN = 2.8;            // the gadget leaves, radians a second round Klayman
const DUG = ['#c9a46a', '#e0c08a', '#a07c45'];   // the shovel's light-brown dirt
const RUSH = ['#ff5a4a', '#ffb070', '#ffe9a8'];   // the booster: red sparks
const DULL = ['#8a8a8a', '#b0b0b0'];              // ...and grey once it wears off
const BIG = 1.2;                  // how much bigger the booster makes him
// What the glasses call each of a sprout's powers, above the sprout.
const POWER_WORDS = { coin: 'coin', item: 'item', closes: 'closes', opens: 'opens', spores: 'spores', heal: 'heal', grow: 'grow', sun: 'sun' };
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
    this.weather = new Weather({ calm: this.calm });   // how the season looks
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
    this.feed = 0;                 // seconds of fertilizer still raining down
    this.patches = [];             // the shovel's dirt, settling on the soil
    this.shake = 0;
    this.weather?.clear();
  }

  /** The shovel's dirt: light-brown specks over the whole ring, drifting up. */
  spray(x, y, reach) {
    const n = this.calm ? 16 : 46;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * reach;
      this.particles.push({
        x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * RING_SQUASH - 6, vx: Math.cos(a) * 20, vy: -20 - Math.random() * 30,
        life: 0, max: 0.45 + Math.random() * 0.45, color: DUG[i % DUG.length], size: 2 + (i % 2) * 2, gravity: 40,
      });
    }
  }

  /** Where the shovel's dirt landed: a light-brown patch, fading. */
  drawPatches(dt) {
    const { ctx } = this;
    for (const p of this.patches) {
      p.t += dt;
      const k = p.t / p.max;
      const r = p.reach * (0.6 + 0.4 * Math.min(1, p.t / 0.2));
      ctx.save();
      ctx.globalAlpha = 0.26 * (1 - k);
      ctx.fillStyle = DUG[0];
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * RING_SQUASH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.patches = this.patches.filter((p) => p.t < p.max);
  }

  /** A point on the canvas (CSS pixels) as a point in the pot: where the mouse aims. */
  toWorld(px, py) {
    return { x: this.cam.x + px / this.zoom, y: this.cam.y + py / this.zoom };
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
      this.weather.handle(e, this.cam);
      switch (e.type) {
        case 'hit': this.burst(e.x, e.y - 12, 5, DIRT, 60); break;
        // ------------------------------------------------------- seasons
        case 'sunshine':
          this.burst(top.x, top.y - 10, 18, SPARK, 90, -50);
          if (e.amount > 0) this.floatHeart(top.x, top.y - 20, 'half');
          break;
        case 'lightning':
          this.shake = Math.max(this.shake, 0.25);
          this.burst(e.x, e.y - 14, 16, ['#ffffff', '#cfe9ff', '#8fd0ff'], 150, -30);
          break;
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
        case 'coinAppears':
          if (!e.from) this.burst(e.x, e.y - 12, e.value > 1 ? 10 : 5, SPARK, 60);
          else if (e.from.y < e.from.ground) this.bling(e.from.x, e.from.y);   // out of a daisy
          else {
            // Out of the ground where the boss went down.
            this.burst(e.from.x, e.from.y - 6, 22, DIRT, 150);
            this.burst(e.from.x, e.from.y - 20, 16, SPARK, 120, -60);
          }
          break;
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
        // ------------------------------------------------------- the boss
        case 'bossComing':
          this.shake = 0.35;
          this.burst(e.x, e.y - 8, 10, DIRT, 80);
          break;
        case 'bossRises':
          this.shake = 0.6;
          this.burst(e.x, e.y - 10, 30, DIRT, 170);
          break;
        case 'bossHit': this.burst(e.x, e.y - 16, e.damage >= BOSS.ballDamage ? 14 : 5, DIRT, e.damage >= BOSS.ballDamage ? 130 : 70); break;
        case 'bossSpawn': this.burst(e.x, e.y - 6, 8, GERM, 60); break;
        case 'bossDown':
          this.burst(e.x, e.y - 120, 16, SWEAT, 110, -50);
          this.popup('Worn out!', e.x, e.y - 175, 1.6);
          break;
        case 'bossBurrows':
          this.shake = 0.5;
          this.burst(e.x, e.y, 26, DIRT, 160);
          break;
        // -------------------------------------------------------- gadgets
        case 'gadget':
          if (e.id === 'leaf') this.burst(e.x, e.y - 18, 16, LEAF, 120, -30);
          if (e.id === 'booster') {
            this.ring(e.x, e.y - 4, 70, 0.4, '#ff5a4a', '#ffd0c0');
            this.burst(e.x, e.y - 22, 18, RUSH, 130, -40);
          }
          if (e.id === 'fertilizer') {
            this.feed = 0.9;
            this.popup('Fertilizer!', e.x, e.y - 60, 1.4);
          }
          break;
        case 'mist': this.mist(); break;
        case 'boosterCrash':
          this.burst(e.x, e.y - 22, 14, DULL, 70, -10);
          this.popup('Worn off', e.x, e.y - 58, 1.1, '#c8c8c8');
          break;
        case 'dig':
          // Light-brown dirt flies out over the ring round him, settling as it goes.
          this.ring(e.x, e.y - 4, e.reach, 0.7, '#c9a46a', '#f0dcb0');
          this.patches.push({ x: e.x, y: e.y, reach: e.reach, t: 0, max: 0.9 });
          this.burst(e.x, e.y - 16, 18, DIRT, 150, -50);
          this.spray(e.x, e.y, e.reach);
          this.shake = Math.max(this.shake, 0.15);
          break;
        case 'sprayHeal':
          this.ring(e.x, e.y - 6, 80, 0.6, '#4aa3df', '#d4f0ff');
          if (e.amount > 0) this.floatHeart(top.x, top.y - 20, 'half');
          else this.popup('Full', top.x, top.y - 30, 1);
          break;
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

  /** Two puffs from the mist bottle's nozzle, over the sprout. */
  mist() {
    const nozzle = { x: TREE_SPOT.x - 36, y: TREE_SPOT.y - 16 };
    for (let i = 0; i < 18; i++) {
      const a = -0.35 + (Math.random() * 2 - 1) * 0.45;
      const v = 70 + Math.random() * 80;
      this.particles.push({
        x: nozzle.x, y: nozzle.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0,
        max: 0.4 + Math.random() * 0.3, color: MIST[i % MIST.length], size: 2 + Math.floor(Math.random() * 2) * 2, gravity: 40,
      });
    }
  }

  /** Fertilizer: granules falling all over what the camera sees. */
  rain(dt) {
    if (this.feed <= 0) return;
    this.feed = Math.max(0, this.feed - dt);
    const n = this.calm ? 1 : 4;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: this.cam.x + Math.random() * this.cam.w, y: this.cam.y + Math.random() * this.cam.h * 0.85,
        vx: 0, vy: 60 + Math.random() * 60, life: 0, max: 0.3 + Math.random() * 0.2,
        color: FEED[i % FEED.length], size: 2 + (i % 2) * 2, gravity: 320,
      });
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
    this.weather.ground(ctx, game.season);

    if (game.fertilized) this.drawFeed(game);
    this.drawPatches(dt);
    if (game.bossPlan) this.drawRumble(game);
    const wind = game.windReach;
    if (wind > 0) this.drawGust(game.klay, wind);

    const slowAll = game.fertilized;
    const things = [];
    things.push({ y: TREE_SPOT.y, draw: () => this.drawTree(game) });
    if (game.boss) things.push({ y: game.boss.y, draw: () => this.drawBoss(game.boss, game) });
    for (const b of game.bacteria) things.push({ y: b.y, draw: () => this.drawBacteria(b, game.frozen, slowAll) });
    for (const c of game.coins) things.push({ y: c.y, draw: () => this.drawCoin(c) });
    for (const d of game.dirtballs) things.push({ y: d.y, draw: () => this.drawDirtball(d, game.frozen) });
    for (const item of game.items) things.push({ y: item.y, draw: () => this.drawItem(item) });
    for (const shot of game.shots) things.push({ y: shot.y, draw: () => this.drawShot(shot) });
    things.push({ y: game.klay.y, draw: () => this.drawKlayman(game) });
    const spray = game.gadgets.find((g) => g.id === 'spray' && g.active);
    if (spray) things.push({ y: TREE_SPOT.y + 6, draw: () => this.drawBottle(spray) });
    if (wind > 0) this.leaves(game.klay, wind, things);
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();
    if (game.lock?.lockable && !game.over) this.drawLock(game.lock);
    if (game.klay.steering && !game.over) this.drawAim(game.klay);

    if (game.frozen) this.drawFrost(game.freeze);
    if (game.gear.glasses && !game.over) this.drawGuides(game);
    this.rain(dt);
    this.drawRings(dt);
    this.drawParticles(dt);
    this.drawSparkles(dt);
    this.drawFloaters(dt);
    this.weather.over(ctx, dt);
    this.drawPopups(dt);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.weather.screen(ctx, game.season, this.cssW, this.cssH, dt);
    if (this.markers) this.drawMarkers(game);
  }

  // ------------------------------------------------- off-screen pointers

  /** Arrows at the screen edge pointing at things the camera can't see:
   *  the sprout always; bacteria, the boss, items and coins only through the glasses. */
  drawMarkers(game) {
    const marks = [];
    if (game.gear.glasses) {
      for (const b of game.bacteria) {
        if (b.crawling) marks.push({ x: b.x, y: b.y - 12, color: '#5aa266', size: 7 });
      }
      const boss = game.boss ?? game.bossPlan;
      if (boss && (boss.alive ?? true)) marks.push({ x: boss.x, y: boss.y - 40, color: HP.low, size: 13 });
      for (const item of game.items) {
        if (item.blinking && Math.floor(item.t * 8) % 2 === 0) continue;
        marks.push({ x: item.x, y: item.y - 16, color: GOLD, size: 10, icon: item.type, secs: item.landed ? Math.ceil(item.life) : null });
      }
      for (const c of game.coins) {
        if (c.blinking && Math.floor(c.t * 10) % 2 === 0) continue;
        marks.push({ x: c.x, y: c.y - 12, color: GOLD, size: 8, icon: 'coin', secs: Math.ceil(c.life) });
      }
    }
    if (!game.over) {
      // Through the glasses, the sprout's arrow also says when its next power comes.
      const clocks = game.gear.glasses ? game.sproutClocks.map((c) => c.secs) : [];
      const secs = clocks.length ? Math.max(0, Math.ceil(Math.min(...clocks))) : null;
      marks.push({ x: TREE_SPOT.x, y: TREE_SPOT.y - 30, color: '#8cc152', size: 10, icon: 'heart', secs });
    }

    const { ctx } = this;
    const W = this.cssW;
    const H = this.cssH;
    const top = this.markerTop ?? 80;    // keep clear of the score bar and the gadget buttons
    const bottom = 0;
    const pad = 16;
    const cx = W / 2;
    const cy = (H + top - bottom) / 2;
    for (const m of marks) {
      const px = (m.x - this.cam.x) * this.zoom;
      const py = (m.y - this.cam.y) * this.zoom;
      if (px > -4 && px < W + 4 && py > -4 && py < H + 4) continue;
      const dx = px - cx;
      const dy = py - cy;
      const halfW = W / 2 - pad;
      const halfH = (H - top - bottom) / 2 - pad;
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

  /** `slowAll`: the fertilizer is working, so every crawler looks slowed. */
  drawBacteria(b, frozen, slowAll = false) {
    const sp = this.sprites;
    let sheet = sp.bac;
    if (frozen && b.alive) sheet = sp.bacFrozen;
    else if ((b.slowed || slowAll) && b.crawling) sheet = sp.bacSlow;
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
      this.halo(x, y, 0.8);
      this.sprite(img, 0, 0, 16, 16, x, y, 8, 8, { scale: S * (0.6 + 0.4 * p) });
      return;
    }
    const pop = Math.min(1, item.t / 0.25);
    const bob = Math.sin(item.t * 3) * 3;
    const y = item.y - 16 + bob;
    this.shadow(item.x, item.y, 10 * pop, 0.3);
    if (item.glowing) this.halo(item.x, y, pop);
    this.sprite(img, 0, 0, 16, 16, item.x, y, 8, 8, { scale: S * pop });
    if (item.glowing) {
      // A sunflower's item glows: a light wash over it, and a twinkle now and then.
      const shine = this.calm ? 0.35 : 0.2 + 0.3 * Math.abs(Math.sin(item.t * 3.2));
      this.sprite(this.sprites.iconsGlow[item.type], 0, 0, 16, 16, item.x, y, 8, 8, { scale: S * pop, alpha: shine });
      if (!this.calm && Math.random() < 0.06) {
        this.sparkles.push({ x: item.x + (Math.random() * 2 - 1) * 16, y: y + (Math.random() * 2 - 1) * 14, t: 0, max: 0.4, size: 6 });
      }
    }
  }

  /** A soft golden glow behind a sunflower's item, pulsing in pixel rings. */
  halo(x, y, k) {
    const { ctx } = this;
    const pulse = this.calm ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.save();
    for (const [r, a] of [[24, 0.12], [18, 0.18], [13, 0.26]]) {
      ctx.globalAlpha = a * k * (0.75 + 0.25 * pulse);
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), r + pulse * 2, r + pulse * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

  /** How big a coin is drawn: 1K, 5K and the boss's 10K. */
  coinSize(value) { return value >= 10 ? 2 : value >= COINS.dropValue ? 1.4 : 1; }

  drawCoin(c) {
    if (c.blinking && Math.floor(c.t * 10) % 2 === 0) return;
    const { ctx } = this;
    const big = this.coinSize(c.value);
    let x = c.x;
    let y = c.y - 14 * big + Math.sin(c.t * 5) * 2;
    let ground = c.y;
    let pop = Math.min(1, c.t / 0.2);
    if (!c.landed) {
      // Out of a daisy, or out of the ground under a boss: a hop, then it lands.
      const p = 1 - c.flight / COINS.coinFlight;
      const lift = c.from.y < c.from.ground ? 34 : 70;
      x = c.from.x + (c.x - c.from.x) * p;
      y = c.from.y + (c.y - 14 * big - c.from.y) * p - 4 * lift * p * (1 - p);
      ground = c.from.ground + (c.y - c.from.ground) * p;
      pop = 0.5 + 0.5 * p;
    }
    const spin = this.calm ? 1 : 0.5 + 0.5 * Math.abs(Math.cos(c.t * 2.4)); // turns, never edge-on
    const img = this.sprites.coin;
    const w = img.width * S * big * pop;
    const h = img.height * S * big * pop;
    this.shadow(x, ground, 8 * big * pop, 0.3);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(spin, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    if (big > 1 && Math.random() < 0.08 * big) this.burst(x, y - 6, 1, SPARK, 20, -30);
    if (c.speed > 0 && Math.random() < 0.4) this.burst(x, y, 1, SPARK, 10);   // pulled by the backpack
  }

  drawKlayman(game) {
    const k = game.klay;
    const sp = this.sprites;
    const tools = game.gear.tools;
    const dig = game.gadgets.find((g) => g.id === 'shovel' && g.active);
    const hasGun = tools.includes('gun') && !dig;   // digging, he holds the shovel instead
    const look = sp.lookFor(tools);
    // With the dirt gun he doesn't wind up a throw: he aims and fires.
    let kind = k.moving ? 'walk' : 'idle';
    let actionT = k.action ? k.action.t : 0;
    if (k.action && !(hasGun && k.action.kind === 'attack')) kind = k.action.kind;
    if (dig) {
      // Digging: arms out, leaning into it, across the whole dig.
      kind = 'push';
      actionT = Math.min(0.19, (dig.t / dig.spec.time) * 0.2);
    }
    const clock = kind === 'idle' ? this.time : k.t;
    const { col, row } = KLAY.frame(kind, k.facing, clock, actionT);
    const size = KLAY.size;
    const a = KLAY.anchor;
    const flip = k.facing === 'side' && k.flip;
    const jitter = k.stun > 0 && !this.calm ? Math.sin(this.time * 70) * 1.5 : 0;
    const { ctx } = this;

    // The booster: red, bigger and glowing for its boost, then grey.
    const shot = game.gadgets.find((g) => g.id === 'booster' && g.active);
    const phase = game.booster;
    let grow = 1;
    let red = 0;
    let grey = 0;
    if (shot && phase === 'boost') {
      const { time } = shot.spec.boost;
      const k01 = Math.min(1, shot.t / 0.2, (time - shot.t) / 0.2);
      grow = 1 + (BIG - 1) * k01;
      red = k01 * (this.calm ? 0.6 : 0.5 + 0.2 * Math.sin(this.time * 12));
    } else if (shot && phase === 'crash') {
      grey = Math.min(1, (shot.t - shot.spec.boost.time) / 0.25, shot.on / 0.3);
    }
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.scale(grow, grow);
    ctx.translate(-k.x, -k.y);
    if (red > 0) this.glow(k, red);
    if (grey > 0 && !this.calm && Math.random() < 0.1) this.burst(k.x, k.y - 30, 1, DULL, 20, 30);

    if (game.medicine > 0) {
      const pulse = 0.25 + 0.12 * Math.sin(this.time * 10);
      const { ctx } = this;
      ctx.fillStyle = `rgba(255,214,90,${pulse})`;
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (Math.random() < 0.15) this.burst(k.x, k.y - 20, 1, SPARK, 30, -40);
    }

    const gun = hasGun ? () => this.drawGun(k, row, col, flip, jitter) : null;
    const pack = tools.includes('backpack');
    if (gun && k.facing === 'back') gun();      // held up the pot, behind him
    if (pack && k.facing === 'front') this.drawPack(k, row, col, flip, jitter, 'behind');
    this.sprite(look.sheet, col * size, row * size, size, size, k.x + jitter, k.y, a.x, a.y, { flip });
    if (pack) this.drawPack(k, row, col, flip, jitter, 'over');
    const green = k.greenness;
    if (green > 0) {
      this.sprite(look.green, col * size, row * size, size, size, k.x + jitter, k.y, a.x, a.y, {
        flip,
        alpha: green * 0.55, // "turn green a bit"
      });
    }
    for (const [sheet, alpha] of [[look.red, red], [look.grey, grey]]) {
      if (alpha > 0) this.sprite(sheet, col * size, row * size, size, size, k.x + jitter, k.y, a.x, a.y, { flip, alpha });
    }
    if (gun && k.facing !== 'back') gun();
    if (dig) this.drawShovel(k, dig);
    if (tools.includes('gloves') && k.action?.kind === 'attack') this.drawStreaks(k);
    ctx.restore();
  }

  /** The booster's glow round Klayman: red rings, pulsing, and sparks rising. */
  glow(k, strength) {
    const { ctx } = this;
    const pulse = this.calm ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 9);
    ctx.save();
    for (const [r, a] of [[30, 0.1], [24, 0.16], [18, 0.22]]) {
      ctx.globalAlpha = a * strength * (0.8 + 0.4 * pulse);
      ctx.fillStyle = '#ff4a3a';
      ctx.beginPath();
      ctx.ellipse(Math.round(k.x), Math.round(k.y - 19), r + pulse * 2, r * 1.15 + pulse * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!this.calm && Math.random() < 0.35) {
      this.burst(k.x + (Math.random() * 2 - 1) * 12, k.y - 10 - Math.random() * 26, 1, RUSH, 30, -60);
    }
  }

  /** The shovel, above his head (v22; it was in his hand): out it comes,
   *  the blade goes in, comes up full and tosses the dirt, and away it goes.
   *  It swings round its grip. */
  drawShovel(k, g) {
    const { img, grip } = this.sprites.shovel;
    const t = g.t;
    let angle = -1.1;
    let drop = 0;
    let size = 1;
    if (t < 0.12) { size = t / 0.12; angle = -0.5; }
    else if (t < 0.4) { const p = (t - 0.12) / 0.28; angle = -0.5 + 0.9 * p; drop = 5 * p; }
    else if (t < 0.6) { const p = (t - 0.4) / 0.2; angle = 0.4 - 1.5 * p; drop = 5 * (1 - p); }
    else size = Math.max(0, 1 - (t - 0.6) / 0.15);
    if (this.calm) angle = 0;
    const { ctx } = this;
    ctx.save();
    // The grip sits a shovel's length above the top of his head, so the blade just clears his hair.
    ctx.translate(Math.round(k.x), Math.round(k.y - (KLAY.anchor.y - 19) * S - img.height * S + 12 + drop * S));
    ctx.rotate(angle);
    ctx.scale(size, size);
    ctx.drawImage(img, -grip.x * S, -grip.y * S, img.width * S, img.height * S);
    ctx.restore();
  }

  /** The backpack: from behind, on his back; from the side, sticking out of
   *  his back; from the front, its edges behind him and the straps on his shirt. */
  drawPack(k, row, col, flip, jitter, layer) {
    const art = this.sprites.pack;
    const spot = this.sprites.packSpots[row][col];
    const { ctx } = this;
    const mid = (spot.x0 + spot.x1 + 1) / 2;
    let img = null;
    let fx = 0;
    if (k.facing === 'back' && layer === 'over') { img = art.back; fx = mid - img.width / 2; }
    else if (k.facing === 'side' && layer === 'over') { img = art.side; fx = spot.x0 - img.width + 2; }
    else if (k.facing === 'front' && layer === 'behind') { img = art.front; fx = mid - img.width / 2; }
    ctx.save();
    ctx.translate(Math.round(k.x + jitter), Math.round(k.y));
    if (flip) ctx.scale(-1, 1);
    const ox = -KLAY.anchor.x;
    const oy = -KLAY.anchor.y;
    if (img) ctx.drawImage(img, (fx + ox) * S, (spot.y0 - 1 + oy) * S, img.width * S, img.height * S);
    if (k.facing === 'front' && layer === 'over') {
      ctx.fillStyle = '#b8761a';                 // the straps, over his shoulders
      for (const x of [spot.x0 + 1, spot.x1 - 1]) ctx.fillRect((x + ox) * S, (spot.y0 + oy) * S, S, 3 * S);
    }
    ctx.restore();
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

  /** The dirt gun's lock: four corner brackets round its target (a
   *  bacteria, a dirtball, or the boss's whole body). */
  drawLock(t) {
    const { ctx } = this;
    const pulse = this.calm ? 0 : Math.round(Math.sin(this.time * 9) * 2);
    const boss = t.maxHp !== undefined;
    const half = boss ? { w: 90 + pulse * 2, h: 58 + pulse * 2 } : { w: 19 + pulse, h: 19 + pulse };
    const arm = boss ? 16 : 7;
    const x = Math.round(t.x);
    const y = Math.round(boss ? t.y - 50 : t.y - 12);
    ctx.save();
    for (const [w, color] of [[6, '#2b1a0c'], [3, '#ff5a4a']]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.lineCap = 'square';
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(x + sx * half.w, y + sy * (half.h - arm));
        ctx.lineTo(x + sx * half.w, y + sy * half.h);
        ctx.lineTo(x + sx * (half.w - arm), y + sy * half.h);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The K button steered by hand (a phone): four chalk dots stepping out
   *  from his hand, fading, the way the next throw goes. */
  drawAim(k) {
    const { ctx } = this;
    const a = k.aim;
    const lift = SHOT.height;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const d = 26 + i * 14;
      const x = Math.round((k.x + a.x * d) / 2) * 2;
      const y = Math.round((k.y + a.y * d - lift) / 2) * 2;
      ctx.globalAlpha = 0.85 - i * 0.18;
      ctx.fillStyle = '#2b1a0c';
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = '#fff4e3';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.restore();
  }

  /** Gloves: three short pixel streaks shoot off the way the dirt flies
   *  (any angle). Every speck sits on the art's 2-unit pixel grid. */
  drawStreaks(k) {
    const p = Math.min(1, k.action.t / KLAYMAN.actionTime);
    const { ctx } = this;
    const dot = (x, y) => ctx.fillRect(Math.round(x / 2) * 2 - 1, Math.round(y / 2) * 2 - 1, 2, 2);
    ctx.save();
    ctx.translate(Math.round(k.x), Math.round(k.y - 18));
    ctx.rotate(Math.atan2(k.aim.y, k.aim.x));
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

  /** What the glasses add to the pot: where the next bacteria, items, coins
   *  and boss will appear (up to 3 seconds ahead, with a picture of what's
   *  coming), how long items and coins on the ground will wait, and the
   *  boss's HP. */
  drawGuides(game) {
    game.upcoming.forEach((p, i) => {
      this.target(p, 1 - Math.min(1, game.untilUpcoming(i) / LOOKAHEAD));
    });
    for (const source of game.itemSources) {
      if (!source.next) continue;
      const icons = source.kind === 'flower' ? this.sprites.iconsGlow : this.sprites.icons;
      this.target(source.next, 1 - Math.min(1, source.timer / LOOKAHEAD), { picture: icons[source.next.type] });
    }
    if (game.nextCoin) {
      const k = 1 - Math.min(1, game.coinTimer / LOOKAHEAD);
      this.target(game.nextCoin, k, { picture: this.sprites.coin });
    }
    const daisy = game.flowerCoins;
    if (daisy?.next) {
      const k = 1 - Math.min(1, daisy.timer / LOOKAHEAD);
      this.target(daisy.next, k, { picture: this.sprites.coin, scale: this.coinSize(daisy.next.value) });
    }
    if (game.bossPlan) this.target(game.bossPlan, 1 - game.bossWarn / BOSS.warn, { size: 4 });
    for (const item of game.items) {
      if (!item.landed || (item.blinking && Math.floor(item.t * 8) % 2 === 0)) continue;
      this.label(String(Math.ceil(item.life)), item.x, item.y - 46, 13);
    }
    for (const c of game.coins) {
      if (!c.landed || (c.blinking && Math.floor(c.t * 10) % 2 === 0)) continue;
      const big = this.coinSize(c.value);
      this.label(String(Math.ceil(c.life)), c.x, c.y - 22 - 12 * big, 12);
    }
    const boss = game.boss;
    if (boss && (boss.alive || boss.state === 'tired')) this.drawHp(boss);
    // The sprout's powers: what comes next, and in how many seconds.
    const top = TREE_SPOT.y - 70 * game.treeScale - 14;
    game.sproutClocks.forEach((c, i) => {
      this.label(`${POWER_WORDS[c.power]} ${Math.max(0, Math.ceil(c.secs))}`, TREE_SPOT.x, top - i * 16, 13);
    });
  }

  /** The boss's HP, through the glasses: a bar, green, yellow from half, red
   *  from a fifth, and what's left of its full HP. */
  drawHp(boss) {
    const { ctx } = this;
    const share = Math.max(0, boss.hpShare);
    const color = share > 0.5 ? HP.full : share > 0.2 ? HP.half : HP.low;
    const rise = boss.state === 'rising' ? Math.min(1, boss.fx / BOSS.rise) : 1;
    const w = 112;
    const h = 10;
    const x = Math.round(boss.x - w / 2);
    // Above its head; when that's up under the score bar, under its feet instead.
    const above = boss.y - BOSS_ART.top * S * rise - 22;
    const y = Math.round(above >= this.cam.y + 104 / this.zoom ? above : boss.y + 30);
    ctx.save();
    ctx.fillStyle = VISOR_INK;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = 'rgba(127, 220, 255, 0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * share / 2) * 2, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x, y, Math.round(w * share / 2) * 2, 2);
    ctx.fillStyle = VISOR_INK;
    for (let i = 1; i < 10; i++) ctx.fillRect(x + Math.round((w * i) / 20) * 2 - 1, y, 2, h);
    ctx.restore();
    this.label(`${Math.ceil(boss.hp)}/${boss.maxHp}`, boss.x, y - 14, 15);
  }

  /** A dotted ring on the soil that closes in as the moment comes, with a
   *  see-through `picture` of what's coming (an item, a coin) in the middle,
   *  or a dot for a bacteria. `size` makes the ring bigger (the boss's);
   *  `scale` the picture (a bigger coin). */
  target(p, k, { picture = null, size = 1, scale = 1 } = {}) {
    const { ctx } = this;
    const r = Math.round((26 - 12 * k) * size);
    const blink = !this.calm && k > 0.8 && Math.floor(this.time * 14) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 0.9;
    for (const [color, grow] of [[VISOR_INK, 2], [VISOR, 0]]) {
      ctx.fillStyle = color;
      const dot = 2 + grow;
      const n = 16 * Math.ceil(size);
      for (let i = 0; i < n; i++) {
        if (i % 4 === 3) continue;               // gaps, like a sight
        const a = (i / n) * Math.PI * 2 + this.time * 1.5 / size;
        const x = Math.round((p.x + Math.cos(a) * r) / 2) * 2;
        const y = Math.round((p.y + Math.sin(a) * r * RING_SQUASH) / 2) * 2;
        ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      }
      const cx = Math.round(p.x / 2) * 2;
      const cy = Math.round(p.y / 2) * 2;
      if (!picture) ctx.fillRect(cx - dot / 2 - 1, cy - dot / 2 - 1, dot + 2, dot + 2);
    }
    ctx.restore();
    if (picture) {
      const bob = this.calm ? 0 : Math.round(Math.sin(this.time * 4) * 2);
      const { width: w, height: h } = picture;
      this.sprite(picture, 0, 0, w, h, p.x, p.y - 14 * scale + bob, w / 2, h / 2, {
        alpha: blink ? 0.3 : 0.55 + 0.3 * k,
        scale: S * scale,
      });
    }
  }

  // ---------------------------------------------------------------- boss

  /** The boss: boss.png, drawn 2x like every sprite, so its pixels match
   *  Klayman's. It climbs out of the ground, waves its legs, shudders before
   *  it sends a bacteria out and flashes when hit; worn out, it droops,
   *  pants and sweats, then sinks back into the soil. Every move is in whole
   *  art pixels, so it never blurs. */
  drawBoss(boss, game) {
    const sp = this.sprites.boss;
    const art = BOSS_ART;
    const { ctx } = this;
    const k = game.klay;
    const px = (v) => Math.round(v) * S;            // whole art pixels, in world units
    let sheet = game.frozen && boss.alive ? sp.frozen : sp.sheet;
    let frames = art.fight;
    let fps = 5;
    let sink = 0;                // art pixels below the ground
    let dx = 0;
    let dy = 0;
    if (boss.state === 'rising') {
      const p = Math.min(1, boss.fx / BOSS.rise);
      sink = Math.round((1 - p) ** 2 * art.top);
      if (!this.calm) dx = Math.round(Math.sin(this.time * 40) * (1 - p));
      if (Math.random() < 0.5) this.burst(boss.x + (Math.random() * 2 - 1) * 80, boss.y - 2, 2, DIRT, 70);
    } else if (boss.state === 'active') {
      // About to send a bacteria out: a shudder.
      if (!this.calm && boss.spawnTimer < 0.3) dx = Math.round(Math.sin(this.time * 60));
    } else {
      frames = art.tired;
      fps = 2.5;
      if (!this.calm) {
        dx = Math.round(Math.sin(this.time * 3.5) * 2);
        dy = Math.round(Math.abs(Math.sin(this.time * 2.5)));
      }
      if (boss.state === 'tired' && Math.random() < 0.15) {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.burst(boss.x + side * (36 + Math.random() * 20), boss.y - 70, 1, SWEAT, 50, -40);
      }
      if (boss.state === 'burrowing') {
        const q = Math.min(1, boss.fx / BOSS.burrow);
        sink = Math.round(q * q * art.top);
        if (!this.calm) dx = Math.round(Math.sin(this.time * 36));
        if (Math.random() < 0.7) this.burst(boss.x + (Math.random() * 2 - 1) * 90, boss.y - 2, 2, DIRT, 90);
      }
    }
    const frame = frames[this.calm ? 0 : Math.floor(boss.t * fps) % frames.length];
    // Klayman behind it: see him through it.
    const behind = k.y < boss.y && k.y > boss.y - 110 && Math.abs(k.x - boss.x) < 96;
    const alpha = behind ? 0.6 : 1;

    // The hole it comes out of and goes back into, or its shadow.
    if (boss.state === 'rising' || boss.state === 'burrowing') {
      ctx.fillStyle = 'rgba(36, 25, 13, 0.75)';
      ctx.beginPath();
      ctx.ellipse(boss.x, boss.y - 2, 92, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      this.shadow(boss.x, boss.y - 2, 86, 0.34);
    }
    const x = Math.round(boss.x) + px(dx) - art.anchor.x * S;
    const y = Math.round(boss.y) + px(dy + sink) - art.anchor.y * S;
    ctx.save();
    if (sink > 0) {
      // Below the soil line it's out of sight.
      ctx.beginPath();
      ctx.rect(boss.x - 120, boss.y - 200, 240, 200 + S);
      ctx.clip();
    }
    const draw = (img, a = 1) => {
      ctx.globalAlpha = alpha * a;
      ctx.drawImage(img, frame * art.w, 0, art.w, art.h, x, y, art.w * S, art.h * S);
    };
    draw(sheet);
    if (boss.flash > 0) draw(sp.hit, boss.flash / 0.12);
    ctx.restore();
  }

  /** Before the boss rises: the soil shakes and cracks where it will come up. */
  drawRumble(game) {
    const p = game.bossPlan;
    const k = 1 - game.bossWarn / BOSS.warn;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.45 * k;
    ctx.fillStyle = '#24190d';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 30 + 80 * k, (30 + 80 * k) * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (Math.random() < 0.25 + 0.5 * k) this.burst(p.x + (Math.random() * 2 - 1) * 90 * k, p.y, 2, DIRT, 50 + 60 * k);
    if (!this.calm && k > 0.5) this.shake = Math.max(this.shake, 0.08);
  }

  // ------------------------------------------------------------- gadgets

  /** The leaf's wind: a ring of white specks spinning round Klayman's feet. */
  drawGust(k, reach) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    const n = 36;
    for (let i = 0; i < n; i++) {
      if (i % 3 === 2) continue;
      const a = (i / n) * Math.PI * 2 + this.time * LEAF_SPIN * 0.8;
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(a * 3 + this.time * 6);
      const x = Math.round((k.x + Math.cos(a) * reach) / 2) * 2;
      const y = Math.round((k.y + Math.sin(a) * reach * RING_SQUASH) / 2) * 2;
      ctx.fillRect(x - 3, y - 1, 6, 2);
    }
    ctx.restore();
    if (!this.calm && Math.random() < 0.35) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x: k.x + Math.cos(a) * reach, y: k.y - 10 + Math.sin(a) * reach * RING_SQUASH,
        vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120 * RING_SQUASH, life: 0, max: 0.35, color: '#ffffff', size: 2, gravity: 0,
      });
    }
  }

  /** Three leaves spinning round Klayman, each sorted in with everything
   *  else by where it is, so they pass behind him and in front. */
  leaves(k, reach, things) {
    const img = this.sprites.leaf;
    for (let i = 0; i < 3; i++) {
      const a = this.time * LEAF_SPIN + (i * Math.PI * 2) / 3;
      const x = k.x + Math.cos(a) * reach;
      const ground = k.y + Math.sin(a) * reach * RING_SQUASH;
      things.push({
        y: ground,
        draw: () => {
          const { ctx } = this;
          ctx.save();
          ctx.translate(Math.round(x), Math.round(ground - 16));
          ctx.rotate(a * 2);
          ctx.drawImage(img, -img.width * S / 2, -img.height * S / 2, img.width * S, img.height * S);
          ctx.restore();
        },
      });
    }
  }

  /** The mist spray's bottle beside the sprout, squeezed for each puff. */
  drawBottle(g) {
    const img = this.sprites.bottle;
    const { puffs } = g.spec;
    const show = Math.min(1, g.t / 0.15, g.on / 0.2);
    const squeeze = puffs.some((at) => g.t >= at - 0.05 && g.t < at + 0.12) ? 0.22 : 0;
    const { ctx } = this;
    const x = TREE_SPOT.x - 44;
    const y = TREE_SPOT.y + 6;
    this.shadow(x, y, 9 * show, 0.3);
    ctx.save();
    ctx.globalAlpha = show;
    ctx.translate(x, y);
    ctx.rotate(squeeze);
    ctx.scale(show, show);
    ctx.drawImage(img, -img.width * S / 2, -img.height * S, img.width * S, img.height * S);
    ctx.restore();
  }

  /** Fertilizer: the soil darkens a little while the bacteria are slowed. */
  drawFeed(game) {
    const g = game.gadgets.find((x) => x.id === 'fertilizer' && x.active);
    const fade = g ? Math.min(1, g.t / 0.3, g.on / 0.5) : 0;
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(SOIL.cx, SOIL.cy, SOIL.rx, SOIL.ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = `rgba(70, 96, 30, ${0.16 * fade})`;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.restore();
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

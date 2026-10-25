// The setup page: pick a tool and a sprout (buying them the first time),
// switch auto throw, and see Klayman dressed for the game before you start.
import { CATALOG, TOOL_IDS, SPROUT_IDS, priceOf, kindOf, formatK } from './gear.js';
import { Game, NO_INPUT } from './game.js';
import { Renderer } from './render.js';
import { KLAY } from './sprites.js';

const $ = (id) => document.getElementById(id);

const NO_TOOL = { name: 'No tool', says: 'Just Klayman.' };

function pixelCanvas(source, sx, sy, sw, sh) {
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  c.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  c.className = 'gear-pic';
  c.setAttribute('aria-hidden', 'true');
  return c;
}

function iconFor(id, sprites) {
  if (id === 'none') return pixelCanvas(sprites.klay, 16, 19, 16, 25);
  if (kindOf(id) === 'tool') return pixelCanvas(sprites.toolIcons[id], 0, 0, 16, 16);
  return pixelCanvas(sprites.sprouts[id].sheet, 0, 0, 32, 37);
}

// ----------------------------------------------------------------- showcase
// A close-up of the pot: the chosen sprout, and Klayman in the chosen tool,
// throwing now and then so gloves and the gun show what they do.

class Showcase {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas, sprites, { zoom: 2.1, markers: false });
    this.game = null;
    this.clock = 0;
  }

  show(loadout) {
    const game = new Game({ rng: () => 0.5, loadout });
    game.phase = 'showcase';
    game.toSpawn = 0;
    game.coinTimer = Infinity;
    game.klay.x = game.tree.x + 46;
    game.klay.y = game.tree.y + 10;
    // Show the sprout's power straight away rather than in 30 seconds.
    if (game.gear.pulseEvery) game.pulseTimer = 1.2;
    if (game.gear.healEvery) { game.lives -= 1; game.healTimer = 1.2; }
    game.drainEvents();
    this.game = game;
    this.clock = 0.9;
    this.renderer.particles = [];
    this.renderer.popups = [];
    this.renderer.rings = [];
    this.renderer.snapCamera = true;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 1) return;
    this.renderer.resize(Math.floor(r.width), Math.floor(r.height), Math.min(3, devicePixelRatio || 1));
  }

  update(dt) {
    const { game } = this;
    if (!game) return;
    this.clock -= dt;
    const pressed = this.clock <= 0;
    if (pressed) this.clock = 2.2;
    game.update(dt, { ...NO_INPUT, pressed });
    this.renderer.handle(game.drainEvents());
    this.renderer.draw(game, dt, { x: (game.tree.x + game.klay.x) / 2, y: game.tree.y - 25 });
  }
}

// --------------------------------------------------------------- the page

export function createSetup({ wallet, sprites, input, sound, onChange, admin }) {
  const el = {
    purse: $('purse'),
    news: $('shop-news'),
    tools: $('tools'),
    sprouts: $('sprouts'),
    auto: $('setup-auto'),
    admin: $('admin'),
  };
  const showcase = new Showcase($('showcase'), sprites);
  const rows = new Map();
  let armed = null;                // tapped once: tap again to buy

  function makeRow(id) {
    const info = id === 'none' ? NO_TOOL : CATALOG[id];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'gear';
    row.dataset.id = id;
    const text = document.createElement('span');
    text.className = 'gear-text';
    const name = document.createElement('span');
    name.className = 'gear-name';
    name.textContent = info.name;
    const says = document.createElement('span');
    says.className = 'gear-says';
    says.textContent = info.says;
    text.append(name, says);
    const tag = document.createElement('span');
    tag.className = 'gear-tag';
    row.append(iconFor(id, sprites), text, tag);
    row.addEventListener('click', () => choose(id));
    rows.set(id, { row, tag });
    return row;
  }

  el.tools.append(...['none', ...TOOL_IDS].map(makeRow));
  el.sprouts.append(...SPROUT_IDS.map(makeRow));

  function say(text) { el.news.textContent = text; }

  function choose(id) {
    const name = id === 'none' ? NO_TOOL.name : CATALOG[id].name;
    if (id === 'none' || wallet.owns(id)) {
      armed = null;
      wallet.equip(id === 'none' ? null : id);
      say('');
    } else if (!wallet.canAfford(id)) {
      armed = null;
      say(`You need ${formatK(priceOf(id) - wallet.coins)} more for ${name}.`);
      const { row } = rows.get(id);
      row.classList.remove('is-short');
      void row.offsetWidth;
      row.classList.add('is-short');
    } else if (armed !== id) {
      armed = id;
      say(`Tap ${name} again to buy it for ${formatK(priceOf(id))}.`);
    } else {
      armed = null;
      wallet.buy(id);
      sound.unlock();
      sound.play('buy', { volume: 0.6 });
      say(`Bought ${name}. It’s yours to keep.`);
    }
    render();
    onChange?.();
  }

  function render() {
    el.purse.textContent = formatK(wallet.coins);
    for (const [id, { row, tag }] of rows) {
      const owned = id === 'none' || wallet.owns(id);
      const on = id === 'none' ? wallet.tool === null : wallet.isEquipped(id);
      let state = 'owned';
      if (on) state = 'on';
      else if (!owned) state = armed === id ? 'confirm' : wallet.canAfford(id) ? 'for-sale' : 'short';
      row.dataset.state = state;
      row.setAttribute('aria-pressed', String(on));
      tag.textContent = { on: 'On', owned: 'Use', confirm: 'Buy?', 'for-sale': formatK(priceOf(id)), short: formatK(priceOf(id)) }[state];
    }
    el.auto.setAttribute('aria-checked', String(input.auto));
    el.auto.textContent = input.auto ? 'On' : 'Off';
    el.admin.hidden = !wallet.isAdmin;
    for (const b of el.admin.querySelectorAll('[data-level]')) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.level) === admin?.level));
    }
    showcase.show(wallet.loadout);
  }

  // Admin mode: coins, everything or nothing owned, and where a game starts.
  el.admin.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !admin) return;
    armed = null;
    if (b.dataset.level) {
      admin.setLevel(Number(b.dataset.level));
      say(`Games start at level ${b.dataset.level}.`);
    } else if (b.dataset.admin === 'coins') {
      wallet.add(1000);
      say(`Added 1,000K.`);
    } else if (b.dataset.admin === 'unlock') {
      wallet.unlockAll();
      say('Everything is unlocked.');
    } else if (b.dataset.admin === 'lock') {
      wallet.lockAll();
      say('Everything is locked again, so you can try buying.');
    } else if (b.dataset.admin === 'leave') {
      admin.leave();
      say('Back to your own save.');
    }
    render();
  });

  el.auto.addEventListener('click', () => {
    input.setAuto(!input.auto);
    render();
  });

  return {
    render() {
      armed = null;
      say('');
      render();
      showcase.resize();
    },
    resize: () => showcase.resize(),
    update: (dt) => showcase.update(dt),
  };
}

// ------------------------------------------------------------- title face

/** Klayman's face for the title page: breathing with his idle frames, blinking now and then. */
export function createFace(canvas, klay) {
  const crop = { x: 15, y: 19, w: 18, h: 17 };
  canvas.width = crop.w;
  canvas.height = crop.h;
  const g = canvas.getContext('2d');
  // Six idle frames, and a copy of each with the eyes shut.
  const frames = [0, 1, 2, 3, 4, 5].map((col) => {
    const open = pixelCanvas(klay, col * KLAY.size + crop.x, crop.y, crop.w, crop.h);
    const shut = pixelCanvas(open, 0, 0, crop.w, crop.h);
    const sg = shut.getContext('2d');
    const img = sg.getImageData(0, 0, crop.w, crop.h);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] + img.data[i + 1] + img.data[i + 2] >= 600) {
        img.data[i] = 90; img.data[i + 1] = 57; img.data[i + 2] = 31;
      }
    }
    sg.putImageData(img, 0, 0);
    return { open, shut };
  });
  let t = 0;
  return {
    draw(dt, calm) {
      t += dt;
      const f = frames[calm ? 0 : Math.floor(t * 6) % 6];
      const blink = t % 3.4 > 3.25;
      g.clearRect(0, 0, crop.w, crop.h);
      g.drawImage(blink ? f.shut : f.open, 0, 0);
    },
  };
}

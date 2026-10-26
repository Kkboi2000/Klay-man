// The setup page: pick tools and sprouts (buying them the first time), slots
// and level skips, switch auto throw, and see Klayman dressed for the game.
// (Revive isn't sold here: the summary offers it when the sprout is lost.)
import {
  CATALOG, TOOL_IDS, SPROUT_IDS, SLOT_IDS, SKIP_IDS, priceOf, kindOf, formatK,
} from './gear.js';
import { Game, NO_INPUT } from './game.js';
import { ITEMS } from './config.js';
import { Renderer } from './render.js';
import { KLAY } from './sprites.js';

const $ = (id) => document.getElementById(id);

const NO_TOOL = { name: 'No tool', says: 'Just Klayman.' };
/** Where Klayman's head sits in his first idle frame (the title face, and the app icon). */
export const FACE = { x: 15, y: 19, w: 18, h: 17 };
const SLOT_NAMES = ['1st', '2nd'];

export function pixelCanvas(source, sx, sy, sw, sh) {
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
  const kind = kindOf(id);
  if (kind === 'tool') return pixelCanvas(sprites.toolIcons[id], 0, 0, 16, 16);
  if (kind === 'sprout') return pixelCanvas(sprites.sprouts[id].sheet, 0, 0, 32, 37);
  const art = sprites.shopIcons[id.startsWith('skip') ? 'skip' : id];
  return pixelCanvas(art, 0, 0, 16, 16);
}

// ----------------------------------------------------------------- showcase
// A close-up of the pot: the first sprout, and Klayman in the chosen tools,
// throwing now and then so gloves and the gun show what they do.

class Showcase {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas, sprites, { zoom: 2.1, markers: false, smallGun: false });
    this.game = null;
    this.clock = 0;
  }

  show(loadout) {
    const game = new Game({ rng: () => 0.5, loadout: { tools: loadout.tools, sprouts: loadout.sprouts.slice(0, 1) } });
    game.phase = 'showcase';
    game.toSpawn = 0;
    game.coinTimer = Infinity;
    game.itemTimer = Infinity;
    game.klay.x = game.tree.x + 46;
    game.klay.y = game.tree.y + 10;
    // Show the sprout's power straight away rather than in a minute.
    const g = game.gear;
    const soon = 1.2;
    if (g.spores) game.sporeTimer = soon;
    if (g.heal) { game.lives -= 1; game.healTimer = soon; }
    if (g.shield) game.shieldTimer = soon;
    if (g.hide) game.hideTimer = soon;
    if (g.drop) { game.level = ITEMS.unlockLevel; game.itemTimer = soon; }
    game.drainEvents();
    this.game = game;
    this.clock = 0.9;
    this.renderer.clearEffects();
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

/** `startLevel()` says where the next game starts (a level skip, or admin's pick). */
export function createSetup({ wallet, sprites, input, sound, admin, startLevel }) {
  const el = {
    purse: $('purse'),
    news: $('shop-news'),
    tools: $('tools'),
    toolsNote: $('tools-note'),
    sprouts: $('sprouts'),
    sproutsNote: $('sprouts-note'),
    sproutSlots: $('sprout-slots'),
    slots: $('slots'),
    once: $('once'),
    auto: $('setup-auto'),
    admin: $('admin'),
    start: $('start'),
  };
  const showcase = new Showcase($('showcase'), sprites);
  const rows = new Map();
  let armed = null;                // tapped once: tap again to buy
  let sproutSlot = 0;              // which sprout a tap picks: 1st or 2nd

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
  el.slots.append(...SLOT_IDS.map(makeRow));
  el.once.append(...SKIP_IDS.map(makeRow));

  function say(text) { el.news.textContent = text; }

  /** What a tap on something you own does, and what to tell you about it. */
  function use(id) {
    const name = CATALOG[id]?.name;
    const kind = id === 'none' ? 'tool' : kindOf(id);
    if (id === 'none') { wallet.equip(null); return ''; }
    if (kind === 'slot') return `${name} is yours.`;
    wallet.equip(id, sproutSlot);
    if (kind === 'once') return wallet.skip === id ? `Your next game starts at level ${startLevel()}.` : '';
    return '';
  }

  function afterBuying(id) {
    const name = CATALOG[id].name;
    if (id === 'toolSlot') return `Bought the ${name}. Tap two tools to wear both.`;
    if (id === 'sproutSlot') return `Bought the ${name}. Pick a 2nd sprout to take over if the 1st is lost.`;
    if (kindOf(id) === 'once') return `Bought ${name}. Your next game starts there.`;
    return `Bought ${name}. It’s yours to keep.`;
  }

  function choose(id) {
    const name = id === 'none' ? NO_TOOL.name : CATALOG[id].name;
    if (id === 'none' || wallet.owns(id)) {
      armed = null;
      say(use(id));
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
      wallet.buy(id, sproutSlot);
      sound.unlock();
      sound.play('buy', { volume: 0.6 });
      say(afterBuying(id));
    }
    render();
  }

  /** The tag on the right of a row you own: what it's doing for you now. */
  function ownedTag(id) {
    const kind = kindOf(id);
    if (kind === 'slot') return { on: true, text: 'Yours' };
    if (kind === 'sprout' && wallet.hasBackup) {
      const slots = wallet.sproutSlotsOf(id);
      return { on: slots.length > 0, text: slots.length ? slots.map((i) => SLOT_NAMES[i]).join(' & ') : 'Use' };
    }
    const on = wallet.isOn(id);
    return { on, text: on ? 'On' : 'Use' };
  }

  function render() {
    el.purse.textContent = formatK(wallet.coins);
    for (const [id, { row, tag }] of rows) {
      let state;
      let text;
      if (id === 'none') {
        state = wallet.tools.length === 0 ? 'on' : 'owned';
        text = state === 'on' ? 'On' : 'Use';
      } else if (wallet.owns(id)) {
        const t = ownedTag(id);
        state = t.on ? 'on' : 'owned';
        text = t.text;
      } else {
        state = armed === id ? 'confirm' : wallet.canAfford(id) ? 'for-sale' : 'short';
        text = state === 'confirm' ? 'Buy?' : formatK(priceOf(id));
      }
      row.dataset.state = state;
      row.setAttribute('aria-pressed', String(state === 'on'));
      tag.textContent = text;
    }
    el.toolsNote.textContent = wallet.toolSlots > 1 ? 'two per game' : 'one per game';
    el.sproutSlots.hidden = !wallet.hasBackup;
    el.sproutsNote.textContent = wallet.hasBackup ? 'the 2nd takes over if the 1st is lost' : '';
    if (!wallet.hasBackup) sproutSlot = 0;
    for (const b of el.sproutSlots.querySelectorAll('[data-slot]')) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.slot) === sproutSlot));
    }
    el.auto.setAttribute('aria-checked', String(input.auto));
    el.auto.textContent = input.auto ? 'On' : 'Off';
    el.admin.hidden = !wallet.isAdmin;
    for (const b of el.admin.querySelectorAll('[data-level]')) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.level) === admin?.level));
    }
    const level = startLevel();
    el.start.textContent = level > 1 ? `Start at level ${level}` : 'Start';
    showcase.show(wallet.loadout);
  }

  el.sproutSlots.addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    sproutSlot = Number(b.dataset.slot);
    armed = null;
    say(sproutSlot === 1 ? 'Tap a sprout to make it your 2nd.' : 'Tap a sprout to make it your 1st.');
    render();
  });

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
      say('Added 1,000K.');
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
  const crop = FACE;
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

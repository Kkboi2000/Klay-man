// The setup page, with two pages of its own: Klayman's (tools and gadgets)
// and the plant's (sprouts and seasons), each opened from a door on setup's
// first page and split into two tabs. Setup's first page also has slots,
// level skips and the settings (orientation, auto throw, sound, music).
// Every page keeps a window into the pot, and Start. (Revive isn't sold
// here: the summary offers it when the sprout is lost.)
//
// The window: on setup's own page it's wide and shows the game you'll play.
// On Klayman's and the plant's pages it's square and shows just him, or just
// the sprout (the mist spray, which works on the sprout, shows it, with
// Klayman at the edge), with whatever you tapped last in place: something you
// own goes on, something you don't is tried on, so you can see it at work
// before you buy it. Tap it again to buy it.
import {
  CATALOG, TOOL_IDS, SPROUT_IDS, GADGET_IDS, SEASON_IDS, SLOT_IDS, SKIP_IDS, priceOf, kindOf, formatK,
} from './gear.js';
import { Game, NO_INPUT } from './game.js';
import { Renderer } from './render.js';
import { KLAY } from './sprites.js';

const $ = (id) => document.getElementById(id);

const NO_TOOL = { name: 'No tool', says: 'Just Klayman.' };
const NO_GADGET = { name: 'No gadget', says: 'Nothing to use in the game.' };
const NO_SEASON = { name: 'No season', says: 'Plain weather.' };
/** The free rows that put things away: no tool, no gadget, no season. */
const NONE = { none: NO_TOOL, noGadget: NO_GADGET, noSeason: NO_SEASON };
/** Where Klayman's head sits in his first idle frame (the title face, and the app icon). */
export const FACE = { x: 15, y: 19, w: 18, h: 17 };
const SLOT_NAMES = ['1st', '2nd'];
/** Setup's own pages: the title each shows, and its tabs (the first opens first). */
const PAGES = { klayman: 'Klayman', plant: 'Plant' };
const TABS = { klayman: ['tools', 'gadgets'], plant: ['sprouts', 'seasons'] };
/** Things you can try on in the window before buying them. */
const TRIES = new Set(['tool', 'gadget', 'sprout', 'season']);

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
  if (id === 'noSeason') return pixelCanvas(sprites.seasonIcons.noSeason, 0, 0, 16, 16);
  if (NONE[id]) return pixelCanvas(sprites.klay, 16, 19, 16, 25);
  const kind = kindOf(id);
  if (kind === 'season') return pixelCanvas(sprites.seasonIcons[id], 0, 0, 16, 16);
  if (kind === 'tool') return pixelCanvas(sprites.toolIcons[id], 0, 0, 16, 16);
  if (kind === 'gadget') return pixelCanvas(sprites.gadgetIcons[id], 0, 0, 16, 16);
  if (kind === 'sprout') return pixelCanvas(sprites.sprouts[id].sheet, 0, 0, 32, 37);
  const art = sprites.shopIcons[id.startsWith('skip') ? 'skip' : id];
  return pixelCanvas(art, 0, 0, 16, 16);
}

// ----------------------------------------------------------------- showcase
// A little game that plays itself in the window, over and over: every LOOP
// seconds it starts again, so a sprout's power, a gadget, the summer sun or
// a lightning bolt comes round again and again, a moment after it starts.
//
// Views (where the camera looks, and how much of the pot it takes in):
//   home     setup's own page, wide: Klayman by the sprout, in everything picked.
//   klayman  square: just Klayman, far from the sprout, in his tools, throwing
//            now and then, with the gadget (if any) at work.
//   spray    square: the sprout and the mist bottle, Klayman just in at the edge.
//   plant    square: just the sprout, its power, and the season over it.

const LOOP = 5.5;                  // seconds before the little game starts again
const SOON = 1;                    // a sprout's power comes this soon after a start
const THROW_EVERY = 2.2;           // Klayman throws now and then (home and klayman views)
const SPAN = { klayman: 122, spray: 176, plant: 168 };     // world units across the square
const GADGET_SPAN = { leaf: 262, shovel: 290, booster: 150, fertilizer: 150 };
const HOME_ZOOM = 2.1;

/** One string for a scene, to tell whether it changed. */
const keyOf = (scene) => JSON.stringify(scene);

class Showcase {
  constructor(canvas, box, sprites) {
    this.canvas = canvas;
    this.box = box;
    this.renderer = new Renderer(canvas, sprites, { zoom: HOME_ZOOM, markers: false, smallGun: false });
    this.game = null;
    this.scene = null;
    this.key = '';
  }

  /** Shows `scene` ({ view, tools, gadgets, sprouts, season }). The same
   *  scene again only starts over when `replay` (a tap on it). */
  show(scene, replay = false) {
    const key = keyOf(scene);
    if (key === this.key && !replay) return;
    this.key = key;
    this.scene = scene;
    this.renderer.clearEffects();
    this.renderer.snapCamera = true;
    this.build();
    this.resize();
  }

  /** How many world units the window takes in across (null: the home view's fixed zoom). */
  get span() {
    const { view, gadgets } = this.scene;
    if (view === 'home') return null;
    if (view === 'klayman' && gadgets[0]) return GADGET_SPAN[gadgets[0]] ?? SPAN.klayman;
    return SPAN[view];
  }

  /** Starts the little game again, the same scene, with what's in flight left to finish. */
  build() {
    const { view, tools, gadgets, sprouts, season } = this.scene;
    const game = new Game({ rng: () => 0.5, loadout: { tools, sprouts, gadgets, season } });
    for (const gadget of game.gadgets) {
      if (gadget.spec.preview) gadget.spec = { ...gadget.spec, ...gadget.spec.preview };
    }
    game.phase = 'showcase';
    game.toSpawn = 0;
    game.coinTimer = Infinity;
    game.potItems.timer = Infinity;
    game.stormTimer = Infinity;    // the window's lightning is for show (update)
    const t = game.tree;
    const k = game.klay;
    // Where Klayman stands, and the point the window is centred on.
    let center;
    if (view === 'home') {
      k.x = t.x + 46; k.y = t.y + 10;
      center = { x: (t.x + k.x) / 2, y: t.y - 25 };
    } else if (view === 'klayman') {
      k.x = t.x - 185; k.y = t.y + 120;                        // well clear of the sprout and the rim
      const ring = gadgets[0] === 'leaf' || gadgets[0] === 'shovel';
      center = { x: k.x, y: k.y - (ring ? 10 : 24) };
    } else if (view === 'spray') {
      center = { x: t.x - 16, y: t.y - 28 };
      k.x = center.x + SPAN.spray / 2 - 2; k.y = t.y + 12;    // only his near side in the window
    } else {
      k.x = t.x + 330; k.y = t.y - 60;                         // well out of the window
      center = { x: t.x, y: t.y - 30 };
    }
    this.center = center;
    this.preparePowers(game, view);
    game.drainEvents();
    this.game = game;
    this.t = 0;
    this.throwAt = view === 'home' || view === 'klayman' ? 0.9 : Infinity;
    this.loop = Math.max(LOOP, (game.gadgets[0]?.spec.time ?? 0) + 1.6);
    this.bolted = false;
    this.coined = false;
  }

  /** The sprout's power (and summer's sun) a moment after the start, and
   *  short enough to see whole before the next start. */
  preparePowers(game, view) {
    if (view === 'klayman') return;              // the sprout isn't in the window
    const g = game.gear;
    if (g.spores) game.sporeTimer = SOON;
    if (g.heal) { game.lives = Math.max(0.5, game.lives - 1); game.healTimer = g.spores ? SOON + 1.2 : SOON; }
    if (g.growEvery) game.growTimer = SOON + 2.4;
    if (g.shield) game.shieldTimer = SOON;
    if (g.hide) game.hideTimer = SOON;
    if (game.flowerItems) game.flowerItems.timer = SOON;
    if (game.flowerCoins) game.flowerCoins.timer = SOON;
    if (game.weather.sun) game.sunTimer = SOON;
    // Corn and lilies close for long in a game; here, for a few seconds.
    const short = (p) => p && { ...p, time: 2.6 };
    if (g.shield || g.hide) game.gear = Object.freeze({ ...g, shield: short(g.shield), hide: short(g.hide) });
  }

  resize() {
    const w = this.box.clientWidth;
    const h = this.box.clientHeight;
    if (w < 1 || !this.scene) return;
    const span = this.span;
    this.renderer.fixedZoom = span ? w / span : HOME_ZOOM;
    this.renderer.resize(w, h, Math.min(3, devicePixelRatio || 1));
  }

  update(dt) {
    const { game } = this;
    if (!game) return;
    this.t += dt;
    if (this.t >= this.loop) {
      this.build();
      return this.update(0);
    }
    const pressed = this.t >= this.throwAt;
    if (pressed) this.throwAt += THROW_EVERY;
    // The gadget, a moment after each start.
    let use = -1;
    const gadget = game.gadgets[0];
    if (gadget?.ready && this.t >= 0.6) {
      if (gadget.id === 'spray') game.lives = Math.max(0.5, game.maxLives - 0.5);
      use = 0;
    }
    game.update(dt, { ...NO_INPUT, pressed, gadget: use });
    // Coins and items blink out before the next start rather than vanish.
    for (const c of game.coins) if (c.landed) c.life = Math.min(c.life, 3.2);
    for (const item of game.items) if (item.landed) item.life = Math.min(item.life, 3.2);
    // The backpack: a coin turns up near Klayman, and comes running.
    if (game.gear.magnet && this.scene.view === 'klayman' && !this.coined && this.t >= 1.4) {
      this.coined = true;
      game.dropCoin({ x: game.klay.x + 92, y: game.klay.y - 30 }, 1);
    }
    // Rainy: a bolt comes down by the sprout, for show (nothing to strike).
    const events = game.drainEvents().filter((e) => e.type !== 'coin');   // no "+1K": these coins aren't yours
    if (game.weather.storm && this.scene.view !== 'klayman' && !this.bolted && this.t >= 2.4) {
      this.bolted = true;
      events.push({ type: 'lightning', x: game.tree.x + 52, y: game.tree.y + 34 });
    }
    this.renderer.handle(events);
    // The camera's follow puts its target a little below the middle; in the
    // square, aim it so the centre lands mid-window.
    const c = this.center;
    const lead = this.scene.view === 'home' ? 0 : 0.08 * this.renderer.cam.h;
    this.renderer.draw(game, dt, { x: c.x, y: c.y + lead });
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
    gadgets: $('gadgets'),
    gadgetsNote: $('gadgets-note'),
    seasons: $('seasons'),
    sproutSlots: $('sprout-slots'),
    slots: $('slots'),
    once: $('once'),
    auto: $('setup-auto'),
    admin: $('admin'),
    start: $('start'),
    screen: $('setup'),
    title: $('setup-name'),
    back: $('setup-back'),
    home: $('setup-home'),
    pages: { klayman: $('page-klayman'), plant: $('page-plant') },
    doors: { klayman: $('door-klayman'), plant: $('door-plant') },
    doorPics: { klayman: document.querySelector('[data-pic="klayman"]'), plant: document.querySelector('[data-pic="plant"]') },
    tablists: [...document.querySelectorAll('.tabs[data-for]')],
    tabs: [...document.querySelectorAll('[data-tab]')],
  };
  const showcase = new Showcase($('showcase'), document.querySelector('.peek'), sprites);
  const rows = new Map();
  let armed = null;                // tapped once: tap again to buy
  let sproutSlot = 0;              // which sprout a tap picks: 1st or 2nd
  let page = null;                 // the page open: 'klayman', 'plant', or null for setup's own
  const tabOf = { klayman: 'tools', plant: 'sprouts' };   // each page's open tab, kept while you're on setup
  let look = null;                 // what was tapped last on this tab: the window shows it
  el.doorPics.klayman.append(pixelCanvas(sprites.klay, 16, 19, 16, 25));

  function makeRow(id) {
    const info = NONE[id] ?? CATALOG[id];
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
  el.gadgets.append(...['noGadget', ...GADGET_IDS].map(makeRow));
  el.seasons.append(...['noSeason', ...SEASON_IDS].map(makeRow));
  el.slots.append(...SLOT_IDS.map(makeRow));
  el.once.append(...SKIP_IDS.map(makeRow));

  function say(text) { el.news.textContent = text; }

  /** What a tap on something you own does, and what to tell you about it. */
  function use(id) {
    const name = CATALOG[id]?.name;
    const kind = kindOf(id);
    if (id === 'none') { wallet.equip(null); return ''; }
    if (id === 'noGadget') { wallet.equip('noGadget'); return ''; }
    if (id === 'noSeason') { wallet.equip('noSeason'); return ''; }
    if (kind === 'slot') return `${name} is yours.`;
    wallet.equip(id, sproutSlot);
    if (kind === 'once') return wallet.skip === id ? `Your next game starts at level ${startLevel()}.` : '';
    return '';
  }

  function afterBuying(id) {
    const name = CATALOG[id].name;
    if (id === 'toolSlot') return `Bought the ${name}. Tap two tools to wear both.`;
    if (id === 'sproutSlot') return `Bought the ${name}. Pick a 2nd sprout to take over if the 1st is lost.`;
    if (id === 'gadgetSlot') return `Bought the ${name}. Tap two gadgets to take both.`;
    if (kindOf(id) === 'gadget') return `Bought ${name}. In a game, tap its button (G on a computer).`;
    if (kindOf(id) === 'once') return `Bought ${name}. Your next game starts there.`;
    if (kindOf(id) === 'season') return `Bought ${name}. Your games are played in it until you pick another.`;
    return `Bought ${name}. It’s yours to keep.`;
  }

  function choose(id) {
    const name = (NONE[id] ?? CATALOG[id]).name;
    const tries = page !== null && TRIES.has(kindOf(id));     // shown in the window, bought or not
    look = id;
    if (NONE[id] || wallet.owns(id)) {
      armed = null;
      say(use(id));
    } else if (!wallet.canAfford(id)) {
      armed = null;
      const short = formatK(priceOf(id) - wallet.coins);
      say(tries ? `Trying ${name}. You need ${short} more to buy it.` : `You need ${short} more for ${name}.`);
      const { row } = rows.get(id);
      row.classList.remove('is-short');
      void row.offsetWidth;
      row.classList.add('is-short');
    } else if (armed !== id) {
      armed = id;
      say(tries ? `Trying ${name}. Tap again to buy it for ${formatK(priceOf(id))}.` : `Tap ${name} again to buy it for ${formatK(priceOf(id))}.`);
    } else {
      armed = null;
      wallet.buy(id, sproutSlot);
      sound.unlock();
      sound.play('buy', { volume: 0.6 });
      say(afterBuying(id));
    }
    render(true);
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

  // ------------------------------------------------------- the window

  /** What the window shows. On setup's own page: the game you'll play. On
   *  Klayman's and the plant's: him, or the sprout, with what you tapped
   *  last in place (something you don't own is tried on, not bought). */
  function scene() {
    const lo = wallet.loadout;
    const sprout = lo.sprouts[0];
    if (page === null) {
      return { view: 'home', tools: lo.tools, gadgets: lo.gadgets.slice(0, 1), sprouts: [sprout], season: lo.season };
    }
    const tried = look && !NONE[look] && !wallet.owns(look) ? look : null;
    const tab = tabOf[page];
    if (tab === 'tools') {
      const tools = tried ? [...lo.tools, tried].slice(-wallet.toolSlots) : lo.tools;
      return { view: 'klayman', tools, gadgets: [], sprouts: [sprout], season: null };
    }
    if (tab === 'gadgets') {
      let gadget = lo.gadgets.at(-1) ?? null;           // the one put on last
      if (tried) gadget = tried;
      else if (look === 'noGadget') gadget = null;
      else if (lo.gadgets.includes(look)) gadget = look;
      return { view: gadget === 'spray' ? 'spray' : 'klayman', tools: lo.tools, gadgets: gadget ? [gadget] : [], sprouts: [sprout], season: null };
    }
    if (tab === 'sprouts') {
      const shown = kindOf(look) === 'sprout' ? look : lo.sprouts[sproutSlot] ?? sprout;
      return { view: 'plant', tools: [], gadgets: [], sprouts: [shown], season: lo.season };
    }
    const season = look === 'noSeason' ? null : kindOf(look) === 'season' ? look : lo.season;
    return { view: 'plant', tools: [], gadgets: [], sprouts: [sprout], season };
  }

  /** `replay`: a row was tapped, so the window starts its little show again. */
  function render(replay = false) {
    el.purse.textContent = formatK(wallet.coins);
    for (const [id, { row, tag }] of rows) {
      let state;
      let text;
      if (NONE[id]) {
        const off = id === 'noSeason' ? !wallet.season : (id === 'none' ? wallet.tools : wallet.gadgets).length === 0;
        state = off ? 'on' : 'owned';
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
      row.classList.toggle('is-trying', page !== null && look === id && state !== 'on' && state !== 'owned');
      row.setAttribute('aria-pressed', String(state === 'on'));
      tag.textContent = text;
    }
    el.toolsNote.textContent = wallet.toolSlots > 1 ? 'two per game' : 'one per game';
    el.gadgetsNote.textContent = wallet.gadgetSlots > 1 ? 'two per game' : 'one per game';
    el.sproutSlots.hidden = !wallet.hasBackup;
    el.sproutsNote.textContent = wallet.hasBackup ? 'the 2nd takes over if the 1st is lost' : 'one per game';
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
    renderPages();
    showcase.show(scene(), replay);
  }

  // ------------------------------------------------------- setup's pages

  const nameOf = (id) => CATALOG[id].name;
  const listOf = (ids) => (ids.length ? ids.map(nameOf).join(', ') : 'none');

  /** Which page shows, its title and back button, its tabs, and what each
   *  door says is picked behind it. */
  function renderPages() {
    el.screen.dataset.page = page ?? 'home';
    el.home.hidden = page !== null;
    for (const [name, view] of Object.entries(el.pages)) view.hidden = page !== name;
    el.title.textContent = page ? PAGES[page] : 'Setup';
    el.back.hidden = page === null;
    if (page) el.admin.hidden = true;
    for (const list of el.tablists) list.hidden = list.dataset.for !== page;
    for (const b of el.tabs) {
      const open = page !== null && tabOf[page] === b.dataset.tab;
      b.setAttribute('aria-selected', String(open));
      b.tabIndex = open ? 0 : -1;
      $(b.getAttribute('aria-controls')).hidden = !open;
    }
    const { tools, gadgets, sprouts, season } = wallet.loadout;
    el.doors.klayman.replaceChildren(`Tool: ${listOf(tools)}`, document.createElement('br'), `Gadget: ${listOf(gadgets)}`);
    const backup = sprouts.length > 1 ? ` (2nd: ${nameOf(sprouts[1])})` : '';
    el.doors.plant.replaceChildren(`Sprout: ${nameOf(sprouts[0])}${backup}`, document.createElement('br'),
      `Season: ${season ? nameOf(season) : 'none'}`);
    if (el.doorPics.plant.dataset.id !== sprouts[0]) {
      el.doorPics.plant.dataset.id = sprouts[0];
      el.doorPics.plant.replaceChildren(iconFor(sprouts[0], sprites));
    }
  }

  /** Forgets what was tapped: a new page or tab starts from what's picked. */
  function fresh() {
    look = null;
    armed = null;
    say('');
  }

  /** Opens Klayman's or the plant's page. It's a step in the browser's
   *  history too, so a phone's back gesture comes back to setup. */
  function open(name) {
    page = name;
    fresh();
    try { history.pushState({ setupPage: name }, ''); } catch { /* no history here: the button still works */ }
    render();
    el.screen.scrollTop = 0;
    el.back.focus({ preventScroll: true });
  }

  /** Back to setup's own page. `fromHistory`: the browser already stepped back. */
  function close(fromHistory = false) {
    if (page === null) return;
    const was = page;
    page = null;
    fresh();
    if (!fromHistory && history.state?.setupPage) history.back();
    render();
    el.screen.scrollTop = 0;
    document.querySelector(`[data-open="${was}"]`)?.focus({ preventScroll: true });
  }

  /** Opens a tab on the page that's open. */
  function openTab(name, focus = false) {
    if (!page || !TABS[page].includes(name) || tabOf[page] === name) return;
    tabOf[page] = name;
    fresh();
    render();
    // Back to the top of the list, under the window.
    el.screen.scrollTop = Math.min(el.screen.scrollTop, $('window').offsetTop);
    if (focus) document.querySelector(`[data-tab="${name}"]`)?.focus({ preventScroll: true });
  }

  for (const door of document.querySelectorAll('[data-open]')) {
    door.addEventListener('click', () => open(door.dataset.open));
  }
  for (const b of el.tabs) {
    b.addEventListener('click', () => openTab(b.dataset.tab));
    // Arrow keys move between a page's two tabs.
    b.addEventListener('keydown', (e) => {
      if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
      const [first, second] = TABS[page] ?? [];
      openTab(tabOf[page] === first ? second : first, true);
      e.preventDefault();
    });
  }
  el.back.addEventListener('click', () => close());
  addEventListener('popstate', () => close(true));
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && page !== null && !el.screen.hidden) close();
  });

  el.sproutSlots.addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    sproutSlot = Number(b.dataset.slot);
    fresh();
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
    /** Shows setup from its own page (coming back from a game, say). */
    render() {
      fresh();
      if (page !== null) close();
      else render();
      showcase.resize();
    },
    /** Leaving setup (a game starts): back to its own page for next time. */
    leave() { close(); },
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

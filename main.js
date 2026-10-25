// Boots Klayman: loads assets, lays out the screen for the device, runs the loop.
import { Game } from './game.js';
import { loadSprites, BAC } from './sprites.js';
import { Renderer } from './render.js';
import { createInput } from './input.js';
import { Sound } from './sound.js';
import { createUI } from './ui.js';

const STEP = 1 / 60;
const BEST_KEY = 'klayman.best';
const $ = (id) => document.getElementById(id);

const app = $('app');
const frame = $('frame');
const canvas = $('screen');
const isPreview = Boolean(globalThis.KLAYMAN_ASSETS);

let mode = 'loading';            // loading | title | playing | paused | over
let touch = matchMedia('(pointer: coarse)').matches;
let game, renderer, input, sound, ui, best;
let overDelay = 0;

// ------------------------------------------------------------- best score

function loadBest() {
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_KEY));
    if (saved && typeof saved.score === 'number') return saved;
  } catch { /* nothing saved yet */ }
  return { score: 0, level: 0 };
}

function saveBest(b) {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* private mode */ }
}

// ----------------------------------------------------------------- layout
// Portrait: the game on top, controls underneath. Landscape: controls on both
// sides. Computer: the game fills the window, played with the keyboard.
// The camera follows Klayman, so the game area can be any shape.

function layout() {
  const r = frame.getBoundingClientRect();
  app.dataset.layout = !touch ? 'desk' : r.height >= r.width ? 'portrait' : 'landscape';
  const stage = $('stage').getBoundingClientRect();
  const w = Math.floor(stage.width);
  const h = Math.floor(stage.height);
  if (!renderer) return;
  renderer.resize(w, h, Math.min(3, devicePixelRatio || 1));
  app.style.setProperty('--u', String(renderer.zoom));
}

// ------------------------------------------------------------ game states

function start() {
  sound.unlock();
  game.reset();
  renderer.particles = [];
  renderer.popups = [];
  ui.reset();
  input.clear();
  overDelay = 0;
  mode = 'playing';
  ui.show(null);
  handleEvents(game.drainEvents());
}

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  input.clear();
  ui.show('paused');
}

function resume() {
  if (mode !== 'paused') return;
  sound.unlock();
  input.clear();
  mode = 'playing';
  ui.show(null);
}

function togglePause() {
  if (mode === 'playing') pause();
  else if (mode === 'paused') resume();
}

function finish(score, level) {
  const isNewBest = score > best.score;
  if (isNewBest) {
    best = { score, level };
    saveBest(best);
    ui.setBest(best);
  }
  ui.setFinal({ score, level, best, isNewBest });
  mode = 'over';
  overDelay = 1.3;               // let the sprout wilt before the screen comes up
}

// ----------------------------------------------------------------- events

const jitter = (base, spread) => base + (Math.random() * 2 - 1) * spread;

function handleEvents(events) {
  if (!events.length) return;
  renderer.handle(events);
  for (const e of events) {
    switch (e.type) {
      case 'throw': sound.play('throw', { volume: 0.35, rate: jitter(1, 0.05) }); break;
      case 'push': sound.play('throw', { volume: 0.5, rate: 0.7 }); break;
      case 'hit': sound.play('hit', { volume: 0.55, rate: jitter(1, 0.1) }); break;
      case 'dirtball': sound.play('hit', { volume: 0.75, rate: 0.8 }); break;
      case 'break': sound.play('break', { volume: 0.7, rate: jitter(1, 0.05) }); break;
      case 'smash': sound.play('break', { volume: 0.9, rate: 1.2 }); break;
      case 'crack': sound.play('hit', { volume: 0.45, rate: 0.6 }); break;
      case 'poison':
        sound.play('hit', { volume: 0.6, rate: 0.55 });
        sound.buzz(20);
        break;
      case 'treeHurt':
        sound.play('break', { volume: 0.9, rate: 0.6 });
        sound.buzz(70);
        break;
      case 'itemAppears': sound.play('hit', { volume: 0.45, rate: 1.8 }); break;
      case 'pickup': sound.play('throw', { volume: 0.6, rate: 1.6 }); break;
      case 'cleared': ui.banner('Pot cleared!', '', 1.1); break;
      case 'level': {
        let news = '';
        if (e.unlocksItems) news = 'From now on, special items will appear near the sprout.';
        if (e.unlocksSkill) news = 'New skill: throw dirt at a dirtball from afar to break it. Up close, you still push it.';
        ui.banner(`Level ${e.level}`, news, news ? 4.5 : 1.8);
        break;
      }
      case 'gameover': finish(e.score, e.level); break;
    }
  }
}

// ------------------------------------------------------------------- loop

let last = performance.now();
let acc = 0;

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (mode === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      game.update(STEP, input.read());
      acc -= STEP;
      steps++;
    }
    if (steps === 6) acc = 0;
    handleEvents(game.drainEvents());
  } else {
    acc = 0;
  }
  if (overDelay > 0) {
    overDelay -= dt;
    if (overDelay <= 0) ui.show('over');
  }
  renderer.draw(game, dt);
  ui.update(game, dt);
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ setup

function dressThrowButton(sheet) {
  // The throw button is a dirtball, cut straight from the sprite sheet.
  const c = document.createElement('canvas');
  c.width = 18;
  c.height = 18;
  c.getContext('2d').drawImage(sheet, 7, BAC.ballY + 7, 18, 18, 0, 0, 18, 18);
  $('throw').style.setProperty('--ball', `url(${c.toDataURL()})`);
}

// ---------------------------------------------------------------- install
// Chrome and Edge offer one-tap install through `beforeinstallprompt`. On a
// repeat visit they make that offer as soon as the page loads, often before
// the sprites and sounds finish decoding, so this runs before anything slow.
// Where there is no offer (iPhone, LINE and other in-app browsers, an offer
// the player already dismissed), a line of text says how to install by hand.

const isInstalled = () => navigator.standalone === true
  || ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches);

function writeInstallTip(tip) {
  const ua = navigator.userAgent;
  if (/\bLine\//.test(ua)) {
    // LINE's own browser can't install apps; this asks LINE to hand the page
    // to the phone's real browser.
    const out = new URL(location.href);
    out.searchParams.set('openExternalBrowser', '1');
    const link = Object.assign(document.createElement('a'), { href: out, textContent: 'Open in your browser' });
    tip.replaceChildren('LINE can’t install apps. ', link, ' to install.');
  } else if (/FBAN|FBAV|Instagram|MicroMessenger|KAKAOTALK/.test(ua)) {
    tip.textContent = 'This in-app browser can’t install apps. Open the page in Safari or Chrome to install.';
  } else if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    tip.textContent = 'To install: tap Share, then Add to Home Screen.';
  } else {
    tip.textContent = 'To install: open the browser menu, then Install app or Add to Home screen.';
  }
}

function setUpInstall() {
  if (isPreview || isInstalled()) return;
  const button = $('install');
  const tip = $('install-tip');
  let offer = null;

  const refresh = () => {
    button.hidden = !offer;
    tip.hidden = Boolean(offer);
  };
  const installed = () => {
    offer = null;
    button.hidden = true;
    tip.hidden = true;
  };

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // our button replaces Chrome's own banner
    offer = e;
    refresh();
  });
  addEventListener('appinstalled', installed);
  button.addEventListener('click', async () => {
    if (!offer) return;
    const asked = offer;
    offer = null;                // an offer can only be used once
    asked.prompt();
    const { outcome } = await asked.userChoice.catch(() => ({}));
    if (outcome === 'accepted') installed();
    else refresh();              // dismissed: the menu route still works
  });

  writeInstallTip(tip);
  refresh();
}

function registerServiceWorker() {
  if (isPreview || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

async function boot() {
  setUpInstall();                // first: the install offer can arrive before assets load
  ui = createUI();
  best = loadBest();
  ui.setBest(best);
  sound = new Sound();
  ui.setSound(sound.muted);

  const [sprites] = await Promise.all([
    loadSprites(),
    sound.load(['throw', 'hit', 'break']),
    document.fonts?.load('600 16px "Pixelify Sans"').catch(() => {}),
  ]);
  renderer = new Renderer(canvas, sprites);
  layout();
  game = new Game();
  game.drainEvents();
  dressThrowButton(sprites.bac);

  input = createInput({
    stickZone: $('stick-zone'),
    stickBase: $('stick-base'),
    stickKnob: $('stick-knob'),
    throwZone: $('throw-zone'),
    throwButton: $('throw'),
    autoButton: $('auto'),
    onPause: togglePause,
  });

  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);
  $('resume').addEventListener('click', resume);
  $('restart').addEventListener('click', start);
  $('pause').addEventListener('click', pause);
  for (const b of document.querySelectorAll('[data-sound]')) {
    b.addEventListener('click', () => {
      sound.setMuted(!sound.muted);
      sound.unlock();
      ui.setSound(sound.muted);
    });
  }

  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !touch) { touch = true; layout(); }
  }, { capture: true });
  addEventListener('resize', layout);
  globalThis.visualViewport?.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  if (new URLSearchParams(location.search).has('debug')) {
    globalThis.klaymanDebug = { get game() { return game; }, start };
  }

  layout();
  app.classList.remove('is-loading');
  mode = 'title';
  ui.show('title');
  requestAnimationFrame(loop);
  registerServiceWorker();
}

boot().catch((err) => {
  $('loading').textContent = `Klayman couldn’t load: ${err.message}. Reload the page to try again.`;
});

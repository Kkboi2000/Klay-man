// The DOM parts: score bar, coins, hearts, power-up timers, level banner and
// the screens laid over the game: title, setup, paused and game over.
import { heartArt, iconArt, coinArt } from './sprites.js';
import { formatK } from './gear.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');

function toImg(canvas, alt = '') {
  const img = new Image();
  img.src = canvas.toDataURL();
  img.alt = alt;
  img.draggable = false;
  return img;
}

export function createUI() {
  const el = {
    score: $('score'),
    level: $('level'),
    hearts: $('hearts'),
    effects: $('effects'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    screens: { title: $('title'), setup: $('setup'), paused: $('paused'), over: $('over') },
    coins: $('coins'),
    finalCoins: $('final-coins'),
    best: $('best'),
    finalScore: $('final-score'),
    finalBest: $('final-best'),
    finalLevel: $('final-level'),
    soundButtons: [...document.querySelectorAll('[data-sound]')],
  };

  // The coin is drawn once and used as a CSS image everywhere it appears.
  document.documentElement.style.setProperty('--coin', `url(${coinArt().toDataURL()})`);

  const heartFull = heartArt(true).toDataURL();
  const heartEmpty = heartArt(false).toDataURL();
  const effectIcons = { bag: iconArt('bag'), sandclock: iconArt('sandclock') };

  let shown = { score: -1, level: -1, hearts: '', effects: '' };
  let bannerTimer = 0;

  function renderHearts(lives, maxLives) {
    const key = `${lives}/${maxLives}`;
    if (key === shown.hearts) return;
    shown.hearts = key;
    el.hearts.replaceChildren(
      ...Array.from({ length: maxLives }, (_, i) => {
        const img = new Image();
        img.src = i < lives ? heartFull : heartEmpty;
        img.alt = '';
        img.className = i < lives ? 'heart' : 'heart is-empty';
        return img;
      }),
    );
    el.hearts.setAttribute('aria-label', `Sprout has ${lives} of ${maxLives} hearts`);
    // More than five hearts (corn, water, a grown mushroom): two even rows.
    el.hearts.classList.toggle('is-many', maxLives > 5);
    el.hearts.style.setProperty('--cols', String(Math.ceil(maxLives / 2)));
  }

  function renderEffects(game) {
    const list = [];
    if (game.boost > 0) list.push(['bag', Math.ceil(game.boost), 'Power up']);
    if (game.freeze > 0) list.push(['sandclock', Math.ceil(game.freeze), 'Bacteria frozen']);
    const key = list.map((e) => e.join(':')).join('|');
    if (key === shown.effects) return;
    shown.effects = key;
    el.effects.replaceChildren(
      ...list.map(([icon, secs, label]) => {
        const chip = document.createElement('span');
        chip.className = 'effect';
        chip.setAttribute('aria-label', `${label}, ${secs} seconds left`);
        chip.append(toImg(effectIcons[icon]), document.createTextNode(`${secs}`));
        return chip;
      }),
    );
  }

  return {
    update(game, dt) {
      if (game.score !== shown.score) {
        shown.score = game.score;
        el.score.textContent = fmt(game.score);
      }
      if (game.level !== shown.level) {
        shown.level = game.level;
        el.level.textContent = `Level ${game.level}`;
      }
      renderHearts(game.lives, game.maxLives);
      renderEffects(game);
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el.banner.hidden = true;
      }
    },

    banner(title, sub = '', seconds = 1.8) {
      el.bannerTitle.textContent = title;
      el.bannerSub.textContent = sub;
      el.bannerSub.hidden = !sub;
      el.banner.hidden = false;
      el.banner.classList.remove('is-in');
      void el.banner.offsetWidth;
      el.banner.classList.add('is-in');
      bannerTimer = seconds;
    },

    hideBanner() {
      el.banner.hidden = true;
      bannerTimer = 0;
    },

    show(name) {
      for (const [key, screen] of Object.entries(el.screens)) screen.hidden = key !== name;
      // Keyboard players can press Enter right away; on a phone, no focus ring.
      if (document.getElementById('app').dataset.layout === 'desk') {
        el.screens[name]?.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
      }
    },

    setBest(best) {
      el.best.textContent = best.score > 0
        ? `Best score ${fmt(best.score)}, reached level ${best.level}`
        : '';
    },

    setCoins(k) {
      el.coins.textContent = formatK(k);
    },

    setFinal({ score, level, best, isNewBest, earned }) {
      el.finalScore.textContent = fmt(score);
      el.finalBest.textContent = isNewBest ? 'New best score!' : `Best ${fmt(best.score)}`;
      el.finalBest.classList.toggle('is-new', isNewBest);
      el.finalLevel.textContent = `You reached level ${level}.`;
      el.finalCoins.textContent = `+${formatK(earned)} coins`;
    },

    setSound(muted) {
      for (const b of el.soundButtons) {
        b.textContent = muted ? 'Sound off' : 'Sound on';
        b.setAttribute('aria-pressed', String(!muted));
      }
    },

    reset() {
      shown = { score: -1, level: -1, hearts: '', effects: '' };
    },
  };
}

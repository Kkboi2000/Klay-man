// The DOM parts: score bar, coins, hearts, what the glasses count, the level
// banner and the screens laid over the game: title, setup, paused and the
// summary when the sprout is lost (with a revive or the backup sprout, if any).
import { heartArt, coinArt } from './sprites.js';
import { CATALOG, formatK } from './gear.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-US');
const hearts = (n) => `${n} ${n === 1 ? 'heart' : 'hearts'}`;

export function createUI() {
  const el = {
    score: $('score'),
    level: $('level'),
    hearts: $('hearts'),
    visor: $('visor'),
    left: $('left'),
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
    chance: $('chance'),
    revive: $('revive'),
    reviveNote: $('revive-note'),
    revivePic: $('revive-pic'),
    backup: $('backup'),
    backupName: $('backup-name'),
    backupPic: $('backup-pic'),
    again: $('again'),
    soundButtons: [...document.querySelectorAll('[data-sound]')],
    musicButtons: [...document.querySelectorAll('[data-music]')],
  };

  // The coin is drawn once and used as a CSS image everywhere it appears.
  document.documentElement.style.setProperty('--coin', `url(${coinArt().toDataURL()})`);

  const heartArtUrl = { full: heartArt('full').toDataURL(), half: heartArt('half').toDataURL(), empty: heartArt('empty').toDataURL() };

  // What's on screen now, so it's only rebuilt when it changes. `left` starts
  // unknown, so a new game always shows or hides the glasses' count afresh.
  let shown = { score: -1, level: -1, hearts: '', left: null };
  let bannerTimer = 0;

  function renderHearts(lives, maxLives) {
    const key = `${lives}/${maxLives}`;
    if (key === shown.hearts) return;
    shown.hearts = key;
    el.hearts.replaceChildren(
      ...Array.from({ length: maxLives }, (_, i) => {
        const kind = lives >= i + 1 ? 'full' : lives >= i + 0.5 ? 'half' : 'empty';
        const img = new Image();
        img.src = heartArtUrl[kind];
        img.alt = '';
        img.className = kind === 'empty' ? 'heart is-empty' : 'heart';
        return img;
      }),
    );
    el.hearts.setAttribute('aria-label', `Sprout has ${lives} of ${maxLives} hearts`);
    // More than five hearts (corn, water, a grown mushroom): two even rows.
    el.hearts.classList.toggle('is-many', maxLives > 5);
    el.hearts.style.setProperty('--cols', String(Math.ceil(maxLives / 2)));
  }

  /** Through the glasses: how many bacteria are still to beat this level. */
  function renderVisor(game) {
    const on = game.gear.glasses;
    const key = on ? String(game.bacteriaLeft) : '';
    if (key === shown.left) return;
    shown.left = key;
    el.visor.hidden = !on;
    if (on) {
      el.left.textContent = key;
      el.visor.setAttribute('aria-label', `${key} bacteria left this level`);
    }
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
      renderVisor(game);
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

    /** `revive`: { hearts, price, coins, have, picture } when a revive is on
     *  offer (`have`: one bought before, so it's free), else null.
     *  `backup`: { id, picture } for the backup sprout that can take over, else null. */
    setFinal({ score, level, best, isNewBest, earned, revive = null, backup = null }) {
      el.finalScore.textContent = fmt(score);
      el.finalBest.textContent = isNewBest ? 'New best score!' : `Best ${fmt(best.score)}`;
      el.finalBest.classList.toggle('is-new', isNewBest);
      el.finalLevel.textContent = `You reached level ${level}.`;
      el.finalCoins.textContent = `+${formatK(earned)} coins`;

      const short = Boolean(revive) && !revive.have && revive.coins < revive.price;
      el.revive.hidden = !revive;
      el.revive.disabled = short;
      if (revive) {
        el.revivePic.src = revive.picture;
        if (revive.have) el.reviveNote.textContent = `${hearts(revive.hearts)} back`;
        else if (short) el.reviveNote.textContent = `Needs ${formatK(revive.price)}. You have ${formatK(revive.coins)}.`;
        else {
          // The price, with the coin before it, as everywhere else.
          const coin = Object.assign(document.createElement('span'), { className: 'coin-icon' });
          coin.setAttribute('aria-hidden', 'true');
          el.reviveNote.replaceChildren(`${hearts(revive.hearts)} back for `, coin, formatK(revive.price));
        }
      }
      el.backup.hidden = !backup;
      if (backup) {
        el.backupName.textContent = `Carry on with the ${CATALOG[backup.id].name.toLowerCase()}`;
        el.backupPic.src = backup.picture;
      }
      el.chance.hidden = !revive && !backup;

      // A second chance you can take is the big button; Play again steps back.
      const first = revive && !short ? el.revive : backup ? el.backup : el.again;
      el.again.className = first === el.again ? 'btn' : 'btn-quiet';
      for (const b of [el.revive, el.backup, el.again]) b.removeAttribute('data-autofocus');
      first.setAttribute('data-autofocus', '');
    },

    setSound(muted) {
      for (const b of el.soundButtons) {
        b.textContent = muted ? 'Sound off' : 'Sound on';
        b.setAttribute('aria-pressed', String(!muted));
      }
    },

    setMusic(on) {
      for (const b of el.musicButtons) {
        b.textContent = on ? 'Music on' : 'Music off';
        b.setAttribute('aria-pressed', String(on));
      }
    },

    reset() {
      shown = { score: -1, level: -1, hearts: '', left: null };
    },
  };
}

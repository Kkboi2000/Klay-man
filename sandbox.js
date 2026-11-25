// Admin mode's sandbox (v27): on the pause screen, everything about the game
// in play, changed at once. The mode (level, or a timer run's clock, and
// whether bacteria keep coming), the sprout, tools, gadgets and seasons
// (any of them, any number: this is for testing), bacteria of each kind,
// the sprout's hearts, coins and items. Resume to see it. Admin mode's save
// is its own, so nothing here touches the real one.
import { CATALOG, TOOL_IDS, SPROUT_IDS, GADGET_IDS, SEASON_IDS, formatK } from './gear.js';
import { ITEM_INFO } from './items.js';
import { clock } from './ui.js';

const KIND_NAMES = { green: 'Green', orange: 'Orange', blue: 'Blue' };

/** `getGame()` is the game in play; `onCoins()` shows the wallet's coins after a change. */
export function createSandbox({ root, getGame, wallet, onCoins }) {
  const rows = root.querySelector('.sandbox-rows');
  const refresh = [];            // each row's way of showing what's on now

  function row(label) {
    const wrap = Object.assign(document.createElement('div'), { className: 'admin-row' });
    const name = Object.assign(document.createElement('span'), { className: 'admin-label', textContent: label });
    wrap.append(name);
    rows.append(wrap);
    return { wrap, name };
  }

  function button(wrap, text, act, pressed = null) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'admin-btn', textContent: text });
    b.addEventListener('click', () => {
      act(getGame());
      render();
    });
    wrap.append(b);
    if (pressed) refresh.push(() => b.setAttribute('aria-pressed', String(pressed(getGame()))));
    return b;
  }

  /** Any number on, tapped on and off. */
  const toggled = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  // The mode: survival's level, or the run's clock; and whether bacteria keep coming.
  const mode = row('Mode');
  const levelButtons = [
    button(mode.wrap, 'Level −1', (g) => g.jumpTo(g.level - 1)),
    button(mode.wrap, '+1', (g) => g.jumpTo(g.level + 1)),
    button(mode.wrap, '+5', (g) => g.jumpTo(g.level + 5)),
  ];
  const clockButtons = [
    button(mode.wrap, 'Clock −30 s', (g) => g.setClock(g.run.left - 30)),
    button(mode.wrap, '+30 s', (g) => g.setClock(g.run.left + 30)),
    button(mode.wrap, 'To 0:05', (g) => g.setClock(5)),
  ];
  button(mode.wrap, 'Bacteria keep coming', (g) => { g.held = !g.held; }, (g) => !g.held);
  refresh.push(() => {
    const g = getGame();
    mode.name.textContent = g.timed ? `Mode: timer, ${clock(g.run.left)} left` : `Mode: survival, level ${g.level}`;
    for (const b of levelButtons) b.hidden = g.timed;
    for (const b of clockButtons) b.hidden = !g.timed;
  });

  const plant = row('Plant');
  for (const id of SPROUT_IDS) button(plant.wrap, CATALOG[id].name, (g) => g.replant(id), (g) => g.gear.sprout === id);

  const tools = row('Tools (any number)');
  for (const id of TOOL_IDS) button(tools.wrap, CATALOG[id].name, (g) => g.wear(toggled(g.loadout.tools, id)), (g) => g.loadout.tools.includes(id));

  const gadgets = row('Gadgets (two at most: a third swaps out the first)');
  for (const id of GADGET_IDS) {
    button(gadgets.wrap, CATALOG[id].name, (g) => g.carry(toggled(g.loadout.gadgets, id).slice(-2)), (g) => g.loadout.gadgets.includes(id));
  }

  const seasons = row('Seasons (any number, mixed)');
  for (const id of SEASON_IDS) button(seasons.wrap, CATALOG[id].name, (g) => g.playIn(toggled(g.seasons, id)), (g) => g.seasons.includes(id));

  const bacteria = row('Bacteria');
  for (const kind of Object.keys(KIND_NAMES)) button(bacteria.wrap, `+1 ${KIND_NAMES[kind]}`, (g) => g.spawnKind(kind));
  button(bacteria.wrap, '+5 mixed', (g) => { for (const kind of ['green', 'green', 'orange', 'blue', 'green']) g.spawnKind(kind); });
  button(bacteria.wrap, 'Clear the pot', (g) => g.clearPot());

  const hearts = row('Sprout hearts');
  button(hearts.wrap, '−½', (g) => g.setHearts(g.lives - 0.5));
  button(hearts.wrap, '+½', (g) => g.setHearts(g.lives + 0.5));
  button(hearts.wrap, 'Full', (g) => g.setHearts(g.maxLives));
  button(hearts.wrap, 'Holds −1', (g) => g.setHearts(g.lives, g.maxLives - 1));
  button(hearts.wrap, 'Holds +1', (g) => g.setHearts(g.lives, g.maxLives + 1));
  refresh.push(() => {
    const g = getGame();
    hearts.name.textContent = `Sprout hearts: ${g.lives} of ${g.maxLives}`;
  });

  const coins = row('Coins');
  for (const k of [1, 5, 10]) button(coins.wrap, `Drop ${k}K`, (g) => g.dropCoinNear(k));
  button(coins.wrap, '+100K to the wallet', () => { wallet.add(100); onCoins(); });
  refresh.push(() => { coins.name.textContent = `Coins: ${formatK(wallet.coins)} in the wallet`; });

  const items = row('Items (near Klayman)');
  for (const [type, info] of Object.entries(ITEM_INFO)) button(items.wrap, info.name, (g) => g.dropItem(type));

  function render() {
    for (const f of refresh) f();
  }

  return {
    /** Shown on the pause screen in admin mode only, up to date. */
    show(on) {
      root.hidden = !on;
      if (on) render();
    },
  };
}

// Tools, sprouts, gadgets, seasons, slots and one-use items: what they're
// called, what they do to the rules, and the wallet that remembers your coins
// and everything you own between games.
import { GADGETS, ONCE, SEASONS, SEASON_LEVEL_UP, SLOTS, SPROUTS, TOOLS, TREE } from './config.js';

export const TOOL_IDS = ['backpack', 'shoes', 'gloves', 'coat', 'glasses', 'gun'];
export const SPROUT_IDS = ['sprout', 'daisy', 'sunflower', 'rose', 'corn', 'lilies', 'mushroom'];
export const GADGET_IDS = ['leaf', 'spray', 'fertilizer', 'shovel', 'booster'];
export const SEASON_IDS = ['summer', 'winter', 'spring', 'autumn', 'rainy'];
export const SLOT_IDS = ['toolSlot', 'sproutSlot', 'gadgetSlot'];
export const ONCE_IDS = ['skip3', 'skip7', 'skip10', 'revive'];
// Sold on the setup page. Revive isn't: it's offered on the summary when the sprout is lost.
export const SKIP_IDS = ['skip3', 'skip7', 'skip10'];

export const CATALOG = {
  backpack: { name: 'Backpack', says: 'A coin magnet: coins close by fly to Klayman.' },
  shoes: { name: 'Shoes', says: '15% faster. Walk right through the sprout.' },
  gloves: { name: 'Gloves', says: 'Throw 15% faster and 15% farther.' },
  coat: { name: 'Coat', says: 'Bacteria can’t get into Klayman. One that touches him slows down 30% for 5 seconds.' },
  glasses: { name: 'Glasses', says: 'Points to bacteria, items and coins, times items and coins, counts what’s left, and shows what appears next and where, and what lightning will strike.' },
  gun: { name: 'Dirt gun', says: 'Locks on to the closest bacteria, boss or dirtball. Throws, range and walking 5% up.' },
  sprout: { name: 'Sprout', says: '3 hearts, up to 7 with water.' },
  daisy: { name: 'Daisy', says: 'Every 30 seconds a coin pops out of the flower: 1K, sometimes 5K, rarely 10K.' },
  sunflower: { name: 'Sunflower', says: 'Every 30 seconds a glowing special item pops out of the flower, from level 1.' },
  rose: { name: 'Rose', says: 'Starts with 4 hearts. Heals 1 heart every 20 seconds.' },
  corn: { name: 'Corn', says: '6 hearts, up to 11. Every 40 seconds its leaves close and keep bacteria out for 15 seconds.' },
  lilies: { name: 'Lilies', says: 'Every 40 seconds it closes for 15 seconds. Bacteria lose sight of it and wander.' },
  mushroom: { name: 'Mushroom', says: 'Spores push bacteria and dirtballs back, and give bacteria a layer of dirt. Heals half a heart every 30 seconds. Grows to 9 hearts.' },
  leaf: { name: 'Leaf', says: 'Three leaves spin round Klayman. Their wind keeps bacteria away for 5 seconds.' },
  spray: { name: 'Mist spray', says: 'Sprays the sprout twice: half a heart back.' },
  fertilizer: { name: 'Fertilizer', says: 'Every bacteria crawls 70% slower for 5 seconds.' },
  shovel: { name: 'Shovel', says: 'Klayman digs and throws dirt all round him: every bacteria near him gets two layers of dirt.' },
  booster: { name: 'Booster', says: 'For 4 seconds Klayman throws twice as fast and as far, walks twice as fast, and his dirt counts double. Then 2 seconds at half of all four.' },
  summer: { name: 'Summer', says: 'Brighter, and the sprout wears shades. Every 50 seconds the sun shines on it: it grows half a heart, up to 2 more.' },
  winter: { name: 'Winter', says: 'A little blue. Every bacteria crawls 15% slower.' },
  spring: { name: 'Spring', says: 'A breeze now and then, and stars twinkle round the sprout. Its powers come round 15% sooner.' },
  autumn: { name: 'Autumn', says: 'In the shade of big trees. Dirtballs take twice as long to crack open; dirt wears off bacteria 50% slower.' },
  rainy: { name: 'Rainy', says: 'A light rain. Every minute lightning strikes the bacteria nearest Klayman, or sends a dirtball rolling at one.' },
  toolSlot: { name: '2nd tool slot', says: 'Wear two tools at once.' },
  sproutSlot: { name: '2nd sprout slot', says: 'Pick a backup sprout. When the first is lost, carry on with it.' },
  gadgetSlot: { name: '2nd gadget slot', says: 'Take two gadgets into a game.' },
  skip3: { name: 'Skip to level 3', says: 'Start a game at level 3. Used once.' },
  skip7: { name: 'Skip to level 7', says: 'Start a game at level 7. Used once.' },
  skip10: { name: 'Skip to level 10', says: 'Start a game at level 10. Used once.' },
  revive: { name: 'Revive', says: 'Bring a lost sprout back with half its hearts.' },
};

const SHOP = { ...TOOLS, ...SPROUTS, ...GADGETS, ...SEASONS, ...SLOTS, ...ONCE };

// Things that were sold under another name. A save keeps what was bought.
const RENAMED = { syringe: 'booster' };
const current = (id) => RENAMED[id] ?? id;

export const priceOf = (id) => SHOP[id]?.price ?? 0;
export function kindOf(id) {
  if (TOOLS[id]) return 'tool';
  if (SPROUTS[id]) return 'sprout';
  if (GADGETS[id]) return 'gadget';
  if (SEASONS[id]) return 'season';
  if (SLOTS[id]) return 'slot';
  if (ONCE[id]) return 'once';
  return null;
}

/** "1,250K": coins are counted in K. */
export const formatK = (n) => `${n.toLocaleString('en-US')}K`;

/** A sprout power's clock with its wait scaled: every N seconds becomes N x wait. */
function sooner(power, wait) {
  if (!power || wait === 1) return power ?? null;
  return { ...power, every: power.every * wait };
}

/** A season's numbers at `level`: level 1's from config.js, each moved 1%
 *  further the player's way for every level after (compounding). Waits and
 *  paces shrink, holds grow. No season: nothing (an empty object). */
export function seasonAt(id, level = 1) {
  const s = SEASONS[id];
  if (!s) return Object.freeze({});
  const steps = Math.max(0, level - 1);
  const less = (v) => v * (1 - SEASON_LEVEL_UP) ** steps;   // a shorter wait, a slower bacteria
  const more = (v) => v * (1 + SEASON_LEVEL_UP) ** steps;   // a longer hold
  const out = { ...s };
  if (s.sun) out.sun = Object.freeze({ ...s.sun, every: less(s.sun.every) });
  if (s.bacteriaPace) out.bacteriaPace = less(s.bacteriaPace);
  if (s.sproutWait) out.sproutWait = less(s.sproutWait);
  if (s.crackHold) out.crackHold = more(s.crackHold);
  if (s.decay) out.decay = more(s.decay);
  if (s.storm) out.storm = Object.freeze({ ...s.storm, every: less(s.storm.every) });
  return Object.freeze(out);
}

/** What the worn tools, a sprout and the season change in the rules. No
 *  tool is plain Klayman. Spring brings every sprout power round sooner,
 *  and a little sooner still at every level. */
export function gearFor({ tools = [], sprout = 'sprout', season = null, level = 1 } = {}) {
  const worn = [...new Set(tools)].filter((id) => TOOLS[id]);
  const s = SPROUTS[sprout] ? sprout : 'sprout';
  const ss = SPROUTS[s];
  const wait = seasonAt(season, level).sproutWait ?? 1;
  const times = (key) => worn.reduce((k, id) => k * (TOOLS[id][key] ?? 1), 1);
  const lives = ss.lives ?? TREE.lives;
  return Object.freeze({
    tools: Object.freeze(worn),
    sprout: s,
    speed: times('speed'),
    fireRate: times('fireRate'),
    range: times('range'),
    lockOn: worn.includes('gun'),
    passSprout: worn.includes('shoes'),
    immune: worn.includes('coat'),
    glasses: worn.includes('glasses'),
    magnet: worn.includes('backpack') ? TOOLS.backpack.magnet : 0,   // how far coins are pulled from
    lives,
    maxLives: Math.max(lives, ss.maxLives ?? TREE.maxLives),
    itemEvery: ss.itemEvery ? ss.itemEvery * wait : null, // sunflower: items pop out of the flower...
    drop: ss.drop ?? null,           // ...or daisy's coins, and land this far off
    coinEvery: ss.coinEvery ? ss.coinEvery * wait : null, // daisy
    coins: ss.coins ?? null,
    heal: sooner(ss.heal, wait),
    spores: sooner(ss.spores, wait),
    growEvery: ss.growEvery ? ss.growEvery * wait : null,
    shield: sooner(ss.shield, wait),
    hide: sooner(ss.hide, wait),
  });
}

// ------------------------------------------------------------------ wallet
// Admin mode keeps its own save (ADMIN_SAVE), so testing never touches the
// player's real coins or purchases.

export const SAVE = 'klayman.wallet';
export const ADMIN_SAVE = 'klayman.wallet.admin';
const ADMIN_START = 9999;
const ALL_IDS = [...TOOL_IDS, ...SPROUT_IDS, ...GADGET_IDS, ...SEASON_IDS, ...SLOT_IDS, ...ONCE_IDS];

function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export class Wallet {
  constructor(storage = safeStorage(), key = SAVE) {
    this.storage = storage;
    this.open(key);
  }

  /** Switches to another save: the player's, or admin's. */
  open(key) {
    this.key = key;
    this.coins = 0;
    this.owned = new Set(['sprout']);
    this.tools = [];               // worn, oldest first
    this.gadgets = [];             // taken along, oldest first
    this.sprouts = ['sprout', 'sprout']; // first, and the backup
    this.season = null;            // the weather over the pot next game, or none
    this.skip = null;              // a level skip to spend on the next game
    const found = this.load();
    // A first visit to admin starts with everything and plenty of coins.
    if (!found && key === ADMIN_SAVE) {
      this.coins = ADMIN_START;
      this.unlockAll();
    }
  }

  get isAdmin() { return this.key === ADMIN_SAVE; }
  get toolSlots() { return this.owns('toolSlot') ? 2 : 1; }
  get gadgetSlots() { return this.owns('gadgetSlot') ? 2 : 1; }
  get hasBackup() { return this.owns('sproutSlot'); }

  /** Admin: own everything (to try it), or nothing but the free sprout (to try buying). */
  unlockAll() {
    for (const id of ALL_IDS) this.owned.add(id);
    this.save();
  }

  lockAll() {
    this.owned = new Set(['sprout']);
    this.tools = [];
    this.gadgets = [];
    this.sprouts = ['sprout', 'sprout'];
    this.season = null;
    this.skip = null;
    this.save();
  }

  /** What the next game is played with. */
  get loadout() {
    return {
      tools: this.tools.slice(0, this.toolSlots),
      sprouts: this.hasBackup ? [...this.sprouts] : [this.sprouts[0]],
      gadgets: this.gadgets.slice(0, this.gadgetSlots),
      season: this.season,
    };
  }

  /** The level the next game starts at: 1, unless a level skip is picked. */
  get startLevel() { return this.skip && this.owns(this.skip) ? ONCE[this.skip].level : 1; }

  owns(id) { return this.owned.has(id); }
  canAfford(id) { return this.coins >= priceOf(id); }
  /** Which sprout slots (0 first, 1 backup) this sprout fills. */
  sproutSlotsOf(id) {
    const slots = [];
    if (this.sprouts[0] === id) slots.push(0);
    if (this.hasBackup && this.sprouts[1] === id) slots.push(1);
    return slots;
  }
  isOn(id) {
    const kind = kindOf(id);
    if (kind === 'tool') return this.tools.includes(id);
    if (kind === 'gadget') return this.gadgets.includes(id);
    if (kind === 'sprout') return this.sproutSlotsOf(id).length > 0;
    if (kind === 'season') return this.season === id;
    return id === this.skip;
  }

  add(k) {
    this.coins += k;
    this.save();
  }

  /** Pays `k` coins for something used on the spot. Returns false if you can't. */
  pay(k) {
    if (this.coins < k) return false;
    this.coins -= k;
    this.save();
    return true;
  }

  /** Buys it and puts it to use. Returns false if it's already yours or too dear. */
  buy(id, slot = 0) {
    if (!kindOf(id) || this.owns(id) || !this.canAfford(id)) return false;
    this.coins -= priceOf(id);
    this.owned.add(id);
    this.equip(id, slot);
    this.save();
    return true;
  }

  /**
   * Puts on what you own. A tool goes on (and with two slots full, the one
   * put on first comes off; tapping a worn one there takes it off); a gadget
   * the same. A sprout fills slot 0 (first) or 1 (backup). A level skip is
   * picked for the next game, or unpicked. A season is the one for the next
   * game. `null` takes every tool off, `'noGadget'` leaves every gadget at
   * home, and `'noSeason'` plays without one.
   */
  equip(id, slot = 0) {
    if (id === null) { this.tools = []; this.save(); return true; }
    if (id === 'noGadget') { this.gadgets = []; this.save(); return true; }
    if (id === 'noSeason') { this.season = null; this.save(); return true; }
    if (!this.owns(id)) return false;
    const kind = kindOf(id);
    if (kind === 'tool') {
      this.tools = this.toggle(this.tools, id, this.toolSlots);
    } else if (kind === 'gadget') {
      this.gadgets = this.toggle(this.gadgets, id, this.gadgetSlots);
    } else if (kind === 'sprout') {
      this.sprouts[slot === 1 ? 1 : 0] = id;
    } else if (kind === 'season') {
      this.season = id;
    } else if (kind === 'once' && ONCE[id].level) {
      this.skip = this.skip === id ? null : id;
    } else {
      return false;
    }
    this.save();
    return true;
  }

  /** Tapping a tool or gadget: on, swapping out the oldest when the slots
   *  are full; with two slots, tapping one that's on takes it off. */
  toggle(list, id, slots) {
    if (list.includes(id)) return slots > 1 ? list.filter((t) => t !== id) : list;
    return [...list, id].slice(-slots);
  }

  /** Spends a one-use item. Returns false if you don't have it. */
  use(id) {
    if (kindOf(id) !== 'once' || !this.owns(id)) return false;
    this.owned.delete(id);
    if (this.skip === id) this.skip = null;
    this.save();
    return true;
  }

  /** Returns false when there is no save yet. */
  load() {
    try {
      const saved = JSON.parse(this.storage?.getItem(this.key));
      if (!saved) return false;
      if (Number.isInteger(saved.coins) && saved.coins >= 0) this.coins = saved.coins;
      for (const id of (saved.owned ?? []).map(current)) if (kindOf(id)) this.owned.add(id);
      // Saves from before the slots kept one `tool` and one `sprout`.
      const tools = Array.isArray(saved.tools) ? saved.tools : [saved.tool];
      this.tools = [...new Set(tools)].filter((id) => kindOf(id) === 'tool' && this.owns(id)).slice(-this.toolSlots);
      const gadgets = Array.isArray(saved.gadgets) ? saved.gadgets.map(current) : [];
      this.gadgets = [...new Set(gadgets)].filter((id) => kindOf(id) === 'gadget' && this.owns(id)).slice(-this.gadgetSlots);
      const sprouts = Array.isArray(saved.sprouts) ? saved.sprouts : [saved.sprout];
      this.sprouts = [0, 1].map((i) => (kindOf(sprouts[i]) === 'sprout' && this.owns(sprouts[i]) ? sprouts[i] : 'sprout'));
      if (kindOf(saved.skip) === 'once' && this.owns(saved.skip)) this.skip = saved.skip;
      if (kindOf(saved.season) === 'season' && this.owns(saved.season)) this.season = saved.season;
      return true;
    } catch { return false; /* nothing saved, or a broken save */ }
  }

  save() {
    try {
      this.storage?.setItem(this.key, JSON.stringify({
        coins: this.coins, owned: [...this.owned], tools: this.tools, gadgets: this.gadgets, sprouts: this.sprouts, season: this.season, skip: this.skip,
      }));
    } catch { /* private mode: it lasts until the page closes */ }
  }
}

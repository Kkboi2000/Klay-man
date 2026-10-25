// Tools and sprouts: what they are called, what they do to the rules, and the
// wallet that remembers your coins and everything you own between games.
import { SPROUTS, TOOLS, TREE } from './config.js';

export const TOOL_IDS = ['shoes', 'gloves', 'coat', 'gun'];
export const SPROUT_IDS = ['sprout', 'sunflower', 'corn', 'rose', 'mushroom'];

export const CATALOG = {
  shoes: { name: 'Shoes', says: '10% faster. Walk right through the sprout.' },
  gloves: { name: 'Gloves', says: 'Throw 10% faster and 10% farther.' },
  coat: { name: 'Lab coat', says: 'Bacteria can’t get into Klayman.' },
  gun: { name: 'Dirt gun', says: 'Shots lock on. 20% faster and farther.' },
  sprout: { name: 'Sprout', says: '3 hearts, up to 6 with water.' },
  sunflower: { name: 'Sunflower', says: 'Special items every 20 seconds.' },
  corn: { name: 'Corn', says: 'Starts with 6 hearts.' },
  rose: { name: 'Rose', says: 'Heals 1 heart every 30 seconds.' },
  mushroom: { name: 'Mushroom', says: 'Spores push bacteria back. Grows to 9 hearts.' },
};

export const priceOf = (id) => (TOOLS[id] ?? SPROUTS[id])?.price ?? 0;
export const kindOf = (id) => (TOOLS[id] ? 'tool' : SPROUTS[id] ? 'sprout' : null);

/** "1,250K": coins are counted in K. */
export const formatK = (n) => `${n.toLocaleString('en-US')}K`;

/** What a tool and a sprout change in the rules. No tool is plain Klayman. */
export function gearFor({ tool = null, sprout = 'sprout' } = {}) {
  const t = TOOLS[tool] ? tool : null;
  const s = SPROUTS[sprout] ? sprout : 'sprout';
  const ts = TOOLS[t] ?? {};
  const ss = SPROUTS[s];
  const lives = ss.lives ?? TREE.lives;
  return Object.freeze({
    tool: t,
    sprout: s,
    speed: ts.speed ?? 1,
    fireRate: ts.fireRate ?? 1,
    range: ts.range ?? 1,
    lockOn: t === 'gun',
    passSprout: t === 'shoes',
    immune: t === 'coat',
    lives,
    maxLives: Math.max(lives, ss.maxLives ?? TREE.maxLives),
    itemEvery: ss.itemEvery ?? null,
    healEvery: ss.healEvery ?? null,
    pulseEvery: ss.pulseEvery ?? null,
    growEvery: ss.growEvery ?? null,
  });
}

// ------------------------------------------------------------------ wallet

const KEY = 'klayman.wallet';

function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export class Wallet {
  constructor(storage = safeStorage()) {
    this.storage = storage;
    this.coins = 0;
    this.owned = new Set(['sprout']);
    this.tool = null;
    this.sprout = 'sprout';
    this.load();
  }

  get loadout() { return { tool: this.tool, sprout: this.sprout }; }

  owns(id) { return this.owned.has(id); }
  canAfford(id) { return this.coins >= priceOf(id); }
  isEquipped(id) { return id === this.tool || id === this.sprout; }

  add(k) {
    this.coins += k;
    this.save();
  }

  /** Buys and puts it on. Returns false if it's already yours or too dear. */
  buy(id) {
    if (!kindOf(id) || this.owns(id) || !this.canAfford(id)) return false;
    this.coins -= priceOf(id);
    this.owned.add(id);
    this.equip(id);
    return true;
  }

  /** One tool at a time (null for none) and one sprout. Only what you own. */
  equip(id) {
    if (id === null) { this.tool = null; this.save(); return true; }
    if (!this.owns(id)) return false;
    if (kindOf(id) === 'tool') this.tool = id;
    else this.sprout = id;
    this.save();
    return true;
  }

  load() {
    try {
      const saved = JSON.parse(this.storage?.getItem(KEY));
      if (!saved) return;
      if (Number.isInteger(saved.coins) && saved.coins >= 0) this.coins = saved.coins;
      for (const id of saved.owned ?? []) if (kindOf(id)) this.owned.add(id);
      if (this.owns(saved.tool) && kindOf(saved.tool) === 'tool') this.tool = saved.tool;
      if (this.owns(saved.sprout) && kindOf(saved.sprout) === 'sprout') this.sprout = saved.sprout;
    } catch { /* nothing saved yet */ }
  }

  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify({
        coins: this.coins, owned: [...this.owned], tool: this.tool, sprout: this.sprout,
      }));
    } catch { /* private mode: it lasts until the page closes */ }
  }
}

// Things to walk over: special items near the sprout from level 3, and coins.
// A sunflower's item first flies out of the flower and lands nearby.
import { COINS, ITEMS, ITEM_FLIGHT, TREE } from './config.js';

export const ITEM_INFO = {
  plus: { name: 'Red plus', says: '+1 heart' },
  bag: { name: 'Bag', says: 'Power up!' },
  water: { name: 'Water drop', says: 'The sprout grows' },
  sandclock: { name: 'Sandclock', says: 'Bacteria frozen' },
};

export class Item {
  /** `from`: where it flies out of (a sunflower's head), or null to just appear. */
  constructor(type, x, y, from = null) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.from = from;
    this.flight = from ? ITEM_FLIGHT : 0;
    this.life = ITEMS.lifetime;    // counts down once it has landed
    this.t = 0;
  }

  get landed() { return this.flight <= 0; }
  get blinking() { return this.life < ITEMS.blinkFrom; }
  get gone() { return this.life <= 0; }

  update(dt) {
    this.t += dt;
    if (this.flight > 0) this.flight = Math.max(0, this.flight - dt);
    else this.life -= dt;
  }
}

/** Which items make sense right now. A full sprout never gets a red plus,
 *  and water only comes while the sprout can still grow. */
export function itemChoices(lives, maxLives, cap = TREE.maxLives) {
  const choices = ['bag', 'sandclock'];
  if (lives < maxLives) choices.push('plus');
  if (maxLives < cap) choices.push('water');
  return choices;
}

export function pickItem(lives, maxLives, rng, cap) {
  const choices = itemChoices(lives, maxLives, cap);
  return choices[Math.floor(rng() * choices.length)];
}

/** A coin worth `value` K, gone after `lifetime` seconds. */
export class Coin {
  constructor(x, y, value, lifetime) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.life = lifetime;
    this.t = 0;
  }

  get blinking() { return this.life < COINS.blinkFrom; }
  get gone() { return this.life <= 0; }

  update(dt) {
    this.t += dt;
    this.life -= dt;
  }
}

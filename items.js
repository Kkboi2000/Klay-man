// Special items appear in the top part of the pot from level 3.
import { ITEMS, TREE } from './config.js';

export const ITEM_INFO = {
  plus: { name: 'Red plus', says: '+1 heart' },
  bag: { name: 'Bag', says: 'Power up!' },
  water: { name: 'Water drop', says: 'The sprout grows' },
  sandclock: { name: 'Sandclock', says: 'Bacteria frozen' },
};

export class Item {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.life = ITEMS.lifetime;
    this.t = 0;
  }

  get blinking() { return this.life < ITEMS.blinkFrom; }
  get gone() { return this.life <= 0; }

  update(dt) {
    this.t += dt;
    this.life -= dt;
  }
}

/** Which items make sense right now. A full sprout never gets a red plus. */
export function itemChoices(lives, maxLives) {
  const choices = ['bag', 'sandclock'];
  if (lives < maxLives) choices.push('plus');
  if (maxLives < TREE.maxLives) choices.push('water');
  return choices;
}

export function pickItem(lives, maxLives, rng) {
  const choices = itemChoices(lives, maxLives);
  return choices[Math.floor(rng() * choices.length)];
}

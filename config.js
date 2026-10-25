// Every number that shapes how Klayman feels lives here.
//
// Your Godot values are kept. Klayman, shots and dirtballs are multiplied by
// FEEL: sprites are drawn at SPRITE_SCALE (2x) so they stay readable on a
// phone, and FEEL keeps the pace lively at that size. Bacteria use your
// original speed. Change FEEL to 1 to get your exact original numbers.

export const SPRITE_SCALE = 2;
const FEEL = 1.5;

// How much bigger the pot is than bg.png. The camera follows Klayman, so
// you only ever see part of the pot.
export const POT_SCALE = 2.5;

export const KLAYMAN = {
  speed: 72 * FEEL,          // klayman.gd SPEED
  attackCooldown: 0.3,       // klayman.gd ATTACK_COOLDOWN
  radius: 11,
  reach: 26,                 // how far in front a dirtball can be pushed
  actionTime: 0.2,           // how long the throw / push pose is shown
  skillLevel: 7,             // from here, dirt thrown from afar breaks a dirtball
};

export const SHOT = {
  speed: 350 * FEEL,         // dirtshot.gd speed
  range: 150 * FEEL,         // dirtshot.gd max_range
  radius: 8,                 // a little forgiving when it lands
  height: 20,                // drawn at hand height
  magnetRange: 62,           // bacteria this close pull a passing shot in...
  magnetTurn: 8,             // ...turning it at most this fast (radians/second)
};

export const BACTERIA = {
  speed: 16,                 // bacteria.gd speed was 24; slowed down
  radius: 13,
  maxDirt: 4,                // hits to make a dirtball (bacteria.gd had 7)
  decayTime: 2.5,            // seconds to shed one layer (bacteria.gd had 1.2)
  levelSpeedUp: 1.05,        // +5% per level
  maxSpeedFactor: 2,         // ...up to double speed
};

export const DIRTBALL = {
  speed: 300 * FEEL,         // dirtball.gd push speed
  radius: 15,
  holdTime: 8,               // seconds before it starts to crack open
};

export const POISON = {
  stun: 0.2,
  slow: 2,
  slowFactor: 0.5,           // half speed, and throws take twice as long
};

export const TREE = {
  lives: 3,
  maxLives: 7,               // water drops grow a sprout up to this (corn and mushroom differ)
  radius: 16,
  growPerWater: 0.12,
};

export const LEVELS = {
  firstCount: 5,
  extraPerLevel: 2,
  spawnEvery: 1.5,
  spawnEveryStep: 0.08,      // spawns come a little quicker each level...
  minSpawnEvery: 0.7,        // ...but never faster than this
  bannerTime: 1.8,
  clearDelay: 1.2,
};

export const ITEMS = {
  unlockLevel: 3,
  every: 60,
  lifetime: 20,              // seconds an item waits to be picked up
  nearSprout: { min: 70, max: 210 }, // how far from the sprout items appear
  blinkFrom: 3,
  pickupRadius: 22,
  bagTime: 10,
  bagBoost: 1.5,
  sandclockTime: 5,
};

export const SCORE = {
  dirtball: 100,             // a dirtball breaks
  smash: 300,                // a rolling dirtball smashes a bacteria
};

// Coins, counted in K. A 1K coin turns up somewhere on the soil every 27
// seconds. A killed bacteria (its dirtball breaks, or a rolling dirtball
// smashes it) drops a 5K coin 5% of the time. Every coin lasts 15 seconds.
export const COINS = {
  every: 27,
  value: 1,
  lifetime: 15,
  dropChance: 0.05,
  dropValue: 5,
  pickupRadius: 22,
  blinkFrom: 3,              // blinks for its last 3 seconds, like items
};

// Tools. Bought once, kept forever; Klayman wears one per game.
// Numbers are multipliers on his own: 1.1 means 10% more.
export const TOOLS = {
  shoes: { price: 29, speed: 1.1 },                    // and he walks through the sprout
  gloves: { price: 29, fireRate: 1.1, range: 1.1 },
  coat: { price: 49 },                                 // bacteria can't get into him
  gun: { price: 99, fireRate: 1.2, range: 1.2 },      // shots lock on to a bacteria
};

// The dirt gun locks on to the bacteria closest to Klayman (within reach of
// a shot), marks it, and keeps him facing it, walking or standing.
export const GUN = {
  lockTurn: 30,              // radians/second: a locked shot never misses
};

// Sprouts. The plain sprout is free; the others are bought once.
export const SPROUTS = {
  sprout: { price: 0 },
  sunflower: { price: 149, itemEvery: 20 },
  corn: { price: 199, lives: 6, maxLives: 6 },
  rose: { price: 249, healEvery: 30 },
  mushroom: {
    price: 299,
    pulseEvery: 40,          // spores push crawling bacteria away...
    push: 120,               // ...this far (not in the brief)...
    slowTime: 4,             // ...and slow them down for 4 seconds...
    slowFactor: 0.5,         // ...to half speed (not in the brief)
    growEvery: 80,           // +1 heart, and a bigger mushroom...
    maxLives: 9,             // ...up to 9
  },
};

export const KNOCK_TIME = 0.35; // how long a spore push takes

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
  pushGap: 6,                // a dirtball this close to touching him can be pushed...
  pushCone: 0.64,            // ...if it's in front of him (within about 50 degrees)
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
  speed: 16 * 1.05,          // bacteria.gd speed was 24; slowed to 16, then 5% back up
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
  minSpawnEvery: 0.7,        // ...but never faster than this...
  spawnRate: 1.1,            // ...and every level spawns 10% more often than that
  bannerTime: 1.8,
  clearDelay: 1.2,
};

// The glasses show where the next bacteria or items appear this long before they do.
export const LOOKAHEAD = 3;

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

// Coins, counted in K. A 1K coin turns up somewhere on the soil every 30
// seconds. A killed bacteria (its dirtball breaks, or a rolling dirtball
// smashes it) drops a 5K coin 4.5% of the time. Every coin lasts 18 seconds.
export const COINS = {
  every: 30,                 // was 27: 10% fewer
  value: 1,
  lifetime: 18,              // was 15: 20% longer
  dropChance: 0.045,         // was 0.05: 10% fewer
  dropValue: 5,
  pickupRadius: 22,
  blinkFrom: 3,              // blinks for its last 3 seconds, like items
};

// Tools. Bought once, kept forever; Klayman wears one per game (two with
// the second tool slot). Numbers are multipliers on his own: 1.15 means 15% more.
export const TOOLS = {
  shoes: { price: 29, speed: 1.15 },                   // and he walks through the sprout
  gloves: { price: 29, fireRate: 1.15, range: 1.15 },
  coat: { price: 49, slowTime: 5, slowFactor: 0.7 },   // bacteria can't get in; a touch slows them 30%
  glasses: { price: 69 },                              // arrows, timers, counts, what's coming next
  gun: { price: 99, fireRate: 1.05, range: 1.05, speed: 1.05 }, // shots lock on to a bacteria
};

// The dirt gun locks on to the bacteria closest to Klayman (within reach of
// a shot), marks it, and keeps him facing it, walking or standing.
export const GUN = {
  lockTurn: 30,              // radians/second: a locked shot never misses
};

// Sprouts. The plain sprout is free; the others are bought once.
export const SPROUTS = {
  sprout: { price: 0 },
  sunflower: {
    price: 149,
    itemEvery: 35,           // a special item pops out of the flower...
    drop: { min: 45, max: 110 }, // ...and lands this far away
  },
  rose: { price: 199, lives: 4, heal: { every: 20, amount: 1 } },
  corn: {
    price: 249,
    lives: 6,
    maxLives: 11,
    shield: { every: 40, time: 15 }, // leaves close over it: bacteria can't get in
  },
  lilies: {
    price: 249,
    hide: { every: 40, time: 15 },   // it closes; bacteria lose sight of it and wander
  },
  mushroom: {
    price: 299,
    spores: {
      every: 25,             // spores push crawling bacteria away...
      push: 60,              // ...this far...
      reach: 248,            // ...if they're inside the ring (25% smaller than the old 330)...
      slowTime: 4,           // ...and slow them down for 4 seconds...
      slowFactor: 0.5,       // ...to half speed
    },
    growEvery: 50,           // +1 heart, and a bigger mushroom...
    maxLives: 9,             // ...up to 9
    heal: { every: 30, amount: 0.5 },
  },
};

// Slots: bought once. A second tool to wear, and a backup sprout.
export const SLOTS = {
  toolSlot: { price: 499 },
  sproutSlot: { price: 999 },
};

// Used once: bought, then spent the first time they're used. You hold one
// of each at a time.
export const ONCE = {
  skip3: { price: 29, level: 3 },
  skip7: { price: 74, level: 7 },
  skip10: { price: 99, level: 10 },
  revive: { price: 49 },     // bought on the summary when the sprout is lost
};

// A revive brings a lost sprout back with half its hearts, once a game, and
// only when there's no backup sprout left to carry on with. A revived sprout
// (or a backup sprout taking over) clears a little room.
export const REVIVE = { reach: 170, push: 80, perGame: 1 };

export const KNOCK_TIME = 0.35; // how long a spore push takes
export const ITEM_FLIGHT = 0.6; // a sunflower's item takes this long to land

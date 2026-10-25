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
  maxLives: 6,
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

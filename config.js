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
  // (Until v26, dirt thrown from level 7 broke a dirtball. Since v27 a
  // dirtball is only ever pushed.)
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
  // bacteria.gd speed was 24; slowed to 16, then 5% back up twice, then 3% down.
  speed: 16 * 1.05 * 1.05 * 0.97,
  radius: 13,
  // Dirt that makes a dirtball, counted in throws (bacteria.gd had 7). It
  // was 4, then 15% more, then 10% less: 4.14. Throws are whole, so that's
  // still five plain throws, but three with medicine (it was four), and
  // two with the booster.
  maxDirt: 4 * 1.15 * 0.9,
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
  spawnRate: 1.1 * 1.1 * 0.94, // ...and every level spawns 10% more often than that twice over, then 6% less
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
  // Medicine (it was a bag until v22; same power-up): for a while Klayman
  // throws quicker and walks faster, and his dirt counts more. v21 cut the
  // bag's 10 seconds and +50% by 45% (x0.55): 5.5 seconds, +27.5%. It never
  // changes how far he throws. Its dirt (x1.5) is as it always was.
  medicine: { time: 10 * 0.55, fireRate: 1 + 0.5 * 0.55, speed: 1 + 0.5 * 0.55, dirt: 1.5 },
  sandclockTime: 5,
};

export const SCORE = {
  dirtball: 100,             // a dirtball breaks
  smash: 300,                // a rolling dirtball smashes a bacteria
  boss: 1000,                // a boss bacteria gives up
  storm: 100,                // lightning (rainy season) kills a bacteria
};

// The brief measures some reaches in "units". A literal 10 would sit inside
// Klayman (he is 11 across the middle), so a unit is 6 world pixels: the
// leaf's and the backpack's 25 units are 150, the shovel's 30 are 180.
export const UNIT = 6;

// Two more kinds of bacteria (v27). The green ones crawl to the sprout.
// Orange ones (one eye, no legs) bounce after Klayman instead, never into the
// sprout, and spit an orange germ at him (orange since v28; yellow before).
// Blue ones (v28: a rounded box with boar's fangs, no legs; it was long legs
// and glasses) never go near the sprout either: they look for bacteria in
// dirt and for dirtballs, and jump to stamp the dirt off them. Each kind is its `share` of a
// level's bacteria from level `from`, of what a boss sends out from
// `bossFrom`, and of what comes in the timer runs listed. Dirt them like any
// other: a dirtball keeps its kind, and what climbs out of it is that kind.
export const KINDS = {
  orange: {
    share: 0.10, from: 20, bossFrom: 25, runs: ['t3', 't5', 't7'],
    reach: 10 * UNIT * 2,      // spits at Klayman from this close (v28: twice v27's 10 units)
    every: 5,                  // a germ every 5 seconds...
    charge: 1,                 // ...the last of them spent charging it up, standing still
    hop: 0.55,                 // seconds a bounce takes
    // Its germ (v28): twice as far as v27's, and 50% faster.
    germ: { speed: 150 * 1.5, range: 10 * UNIT * 1.6 * 2, radius: 5 },
    // A germ on Klayman does what a bacteria inside him does (POISON), but
    // orange, and 20% worse: 20% slower still, and 20% longer.
    poison: { stun: 0.2 * 1.2, slow: 2 * 1.2, slowFactor: 0.5 * 0.8 },
  },
  blue: {
    share: 0.15, from: 10, bossFrom: 35, runs: [],
    reach: 10 * UNIT * 4,      // stamps on dirt this far off (v28: 4 times v27's 10 units)...
    every: 5 / 3,              // ...every 1.67 seconds (v28: 3 times as often as v27's 5)...
    dirt: 1,                   // ...a layer of dirt off one dirty bacteria in reach (v29: one at a time)...
    hold: 2.5,                 // ...or a layer's worth (decayTime) off a dirtball's hold
    keepOff: 90,               // it never comes closer to the sprout than this
    // v30: it gets about the orange way, bouncing, but 2.5 times slower: a
    // bounce takes 2.5 times as long, and goes as far as an orange one's.
    hop: 0.55 * 2.5,
    pace: 1 / 2.5,
    jump: 0.7,                 // the stamp: it jumps up, lands (the stamp itself)...
    land: 0.42,                // ...this far in, and bounces once
    // v29: as it lands it shoots a light-blue shot at one bit of dirt, the
    // nearest in reach; the dirt comes off when the shot gets there.
    zap: { speed: 330 },
  },
};

// A boss bacteria closes every fifth level from 5 (5, 10, 15, ...). Once
// the level's own bacteria are gone it rises out of a corner, stays put and
// sends out bacteria until dirt wears its HP (level x 10, up to level 30's
// 300: v27) down. Then it's worn out, burrows back down, and a 10K coin pops
// out where it was. It's a little redder every level, fully red at 40 (v27).
export const BOSS = {
  firstLevel: 5,
  every: 5,
  size: 4,                   // 4x a normal bacteria (boss.png, drawn by make-boss.py)
  // Where it stands on the soil: a flattened oval around a spot a little
  // above its feet, 4x a bacteria's reach (13 x 4 = 52) and wider than deep.
  foot: { rx: 80, ry: 44, lift: 16 },
  corner: 70,                // how far in from the rim, at a corner of the pot
  hpPerLevel: 10,
  hpUntil: 30,               // its HP grows no further after this level
  redAt: 40,                 // fully red from this level: level/40 red before
  shotDamage: 1,             // a throw (medicine makes it 1.5, the booster 2.5)
  ballDamage: 5,             // a rolling dirtball
  // Seconds between the bacteria it sends out: 2.5 at level 10, and 0.625
  // less every boss level after (1.875 at 15, 1.25 at 20), never under 1
  // (from 25). Level 5 carries the steps back: 3.125.
  spawn: { at: 10, every: 2.5, step: 0.625, min: 1 },
  warn: 2,                   // the ground rumbles this long before it rises...
  rise: 1,                   // ...and it takes this long to climb out
  tired: 1.4,                // worn out: it sags and sweats...
  burrow: 1.4,               // ...then sinks back into the ground
  coin: 10,                  // the coin it leaves, in K
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
  coinFlight: 0.6,           // a daisy's coin, or a boss's, takes this long to land
  magnet: { start: 140, accel: 900, max: 520 }, // the backpack pulls coins in, faster and faster
  blinkFrom: 3,              // blinks for its last 3 seconds, like items
};

// Tools. Bought once, kept forever; Klayman wears one per game (two with
// the second tool slot). Numbers are multipliers on his own: 1.15 means 15% more.
export const TOOLS = {
  backpack: { price: 19, magnet: 25 * UNIT },          // coins this close fly to him
  shoes: { price: 29, speed: 1.15 },                   // and he walks through the sprout
  gloves: { price: 29, fireRate: 1.15, range: 1.15 },
  coat: { price: 49, slowTime: 5, slowFactor: 0.7 },   // bacteria can't get in; a touch slows them 30%
  glasses: { price: 69 },                              // arrows, timers, counts, what's coming next
  gun: { price: 99, fireRate: 1.05, range: 1.05, speed: 1.05 }, // shots lock on to a bacteria
  // Bazoo-klay (v27): a dirt bazooka on his shoulder. Every shot is a wave of
  // dirt fanning out `cone` degrees, 15% slower (waveSpeed) than a throw. v28:
  // it shoots half as often (fireRate) and reaches 70% as far as v27's (90%
  // of a throw: range 0.9 x 0.7). Three hits make a dirtball; a clean bacteria
  // it hits is knocked back 3 units, one already in dirt isn't, nor a dirtball.
  bazoo: { price: 299, fireRate: 0.5, range: 0.9 * 0.7, waveSpeed: 0.85, cone: 40, hits: 3, knock: 3 * UNIT },
};

// The dirt gun locks on to whatever is closest to Klayman within reach of a
// shot (a bacteria or a boss), marks it, and keeps him facing it, walking or
// standing.
export const GUN = {
  lockTurn: 30,              // radians/second: a locked shot never misses
};

// Sprouts. The plain sprout is free; the others are bought once.
export const SPROUTS = {
  sprout: { price: 0 },
  daisy: {
    price: 99,
    // From level 1, a coin pops out of the flower every 30 seconds and lands
    // nearby: 1K most times, 5K now and then, 10K once in a hundred.
    coinEvery: 30,
    coins: [{ value: 1, chance: 0.8 }, { value: 5, chance: 0.19 }, { value: 10, chance: 0.01 }],
    drop: { min: 45, max: 110 },
  },
  sunflower: {
    price: 149,
    // From level 1, a special item pops out of the flower every 30 seconds,
    // glowing, and lands nearby. From level 3 the pot's own items come as well.
    itemEvery: 30,
    drop: { min: 45, max: 110 },
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
      every: 25,             // spores push bacteria and dirtballs away...
      push: 60,              // ...this far...
      reach: 248,            // ...if they're inside the ring (25% smaller than the old 330)...
      dirt: 1,               // ...give every bacteria one more layer of dirt...
      slowTime: 4,           // ...and slow it down for 4 seconds...
      slowFactor: 0.5,       // ...to half speed
    },
    growEvery: 50,           // +1 heart, and a bigger mushroom...
    maxLives: 9,             // ...up to 9
    heal: { every: 30, amount: 0.5 },
  },
  // Cactus (v29): the mushroom's growing and healing, but no spores. Instead,
  // every 15 to 30 seconds (at random; v30: 2.5 times slower than v29's 6 to
  // 12) it shoots a thorn at the nearest
  // bacteria (crawling or in dirt) or dirtball: a crawling bacteria dies on
  // the spot; one in dirt, or a dirtball, breaks. And with a cactus in the
  // pot, no orange or blue bacteria come at all, not even from a boss.
  cactus: {
    price: 299,
    thorns: { min: 6 * 2.5, max: 12 * 2.5, speed: 520 },
    growEvery: 50,
    maxLives: 9,
    heal: { every: 30, amount: 0.5 },
    greenOnly: true,
  },
};

// Gadgets: bought once; one per game (two with the gadget slot). Used with
// G (and H) on a computer, or their buttons in the game's top-right corner.
// After its effect, each takes COOLDOWN seconds to be ready again (v23: 15,
// for every gadget; it was 20).
const COOLDOWN = 15;

export const GADGETS = {
  // The whirlwind (v27; it was "the leaf", and keeps that id so saves still own it).
  leaf: {
    price: 39,
    fling: 7 * UNIT,         // its first gust flings every bacteria inside it this much further out, and sets dirtballs rolling...
    reach: 25 * UNIT,        // three leaves spin out this far round Klayman...
    grow: 0.5,               // ...taking this long to spread
    time: 5,                 // their wind keeps bacteria out for 5 seconds (v23: was 7)
    cooldown: COOLDOWN,
    preview: { reach: 25 * UNIT * 0.7 }, // 30% smaller on the setup page, to fit its window
  },
  spray: {
    price: 39,
    puffs: [0.2, 0.5],       // a mist bottle by the sprout sprays twice...
    heal: 0.5,               // ...and the sprout gets half a heart back
    time: 0.75,
    cooldown: COOLDOWN,
  },
  shovel: {
    price: 39,
    reach: 60 * UNIT * 0.7,  // Klayman digs; dirt flies over this far round him (42 units: v22's 60, 30% smaller)...
    dig: 0.4,                // ...the moment the blade comes up...
    dirt: 2,                 // ...and every bacteria in it gets two layers more (v22: was one)
    time: 0.75,              // he stands and digs this long
    cooldown: COOLDOWN,
    preview: { reach: 30 * UNIT * 0.7 }, // the setup page: 30% smaller than the old 30 units, to fit its window
  },
  booster: {
    price: 39,
    // A shot of something: red, a little bigger and glowing. For 4 seconds
    // he throws 1.875 times as fast (v28: 25% slower than v27's 2.5) and 2.5
    // times as far, walks 2.5 times as fast, and his dirt counts 2.5 times.
    // (The setup page still says twice, on purpose.)...
    boost: { time: 4, fireRate: 2.5 * 0.75, range: 2.5, speed: 2.5, dirt: 2.5 },
    // ...then it wears off: grey, and for 3 seconds (v28: 50% longer than
    // v27's 2) all four drop to half.
    crash: { time: 2 * 1.5, fireRate: 0.5, range: 0.5, speed: 0.5, dirt: 0.5 },
    time: 4 + 2 * 1.5,
    cooldown: COOLDOWN,      // counted from when he's himself again
  },
  fertilizer: {
    price: 39,
    slowFactor: 0.3,         // every bacteria crawls 70% slower...
    time: 5,                 // ...for 5 seconds
    cooldown: COOLDOWN,
  },
  // Radio (v29): static crackles out of Klayman, and for 5 seconds every
  // bacteria does the opposite: green ones crawl away from the sprout, orange
  // ones from Klayman (and spit nothing), blue ones from the dirt (and stamp
  // nothing).
  radio: {
    price: 39,
    time: 5,
    cooldown: COOLDOWN,
  },
  // AI (v29): a see-through, light-blue digital Klayman blinks up beside him
  // like a neon sign, throws plain dirt at the nearest bacteria and pushes
  // the nearest dirtballs into them, then blinks out. It has none of his
  // tools, but walks and throws 1.5 times as fast as he does right now. It's
  // there 5 seconds: 0.75 blinking up, 3.5 at work, 0.75 blinking out.
  ai: {
    price: 39,
    time: 5,
    blink: 0.75,
    speed: 1.5,
    fireRate: 1.5,
    cooldown: COOLDOWN,
  },
};

// Seasons: the weather over the pot. Bought once (169K each); one per game
// (two, mixed, with the 2nd season slot), picked on the setup page under
// Plant > Seasons. None of them touches a boss
// (the bacteria it sends out are ordinary bacteria, so they do feel it).
// These are level 1's numbers: every level after, each one moves 1% further
// the player's way (v24), compounding (SEASON_LEVEL_UP, and seasonAt() in gear.js).
export const SEASONS = {
  // Brighter, and the sprout wears tiny sunglasses. Every 50 seconds the sun
  // spotlights the sprout and it grows half a heart, up to 2 hearts more
  // than it could hold. (Each level: the sun comes 1% sooner.)
  summer: { price: 169, sun: { every: 50, grow: 0.5, max: 2 } },
  // Bluish. Every bacteria crawls at 85% of its speed. (Each level: 1% slower still.)
  winter: { price: 169, bacteriaPace: 0.85 },
  // A breeze now and then, and tiny stars twinkle round the sprout. Every
  // sprout power comes round 15% sooner: its wait is 85% as long (a rose
  // heals every 17 seconds, not 20). (Each level: 1% shorter still.)
  spring: { price: 169, sproutWait: 0.85 },
  // Big trees' leaves and branches shade the pot, and a leaf sticks to every
  // dirtball. Dirtballs take 2.5 times as long to crack open (v24; the setup
  // page says twice, on purpose, like the booster), and dirt takes 50% longer
  // to wear off a bacteria. (Each level: both 1% longer.)
  autumn: { price: 169, crackHold: 2.5, decay: 1.5 },
  // A light rain. Every 36 seconds (v27: 40% sooner than the minute it was)
  // lightning strikes whatever is nearest Klayman (v24; it was anything,
  // anywhere): a bacteria dies, a dirtball rolls at the closest bacteria (or
  // into the pot's rim). The target is picked `warn` seconds early, so the
  // glasses can mark it. (Each level: 1% sooner.)
  rainy: { price: 169, storm: { every: 60 * 0.6, strikes: 1, warn: 2 } },
};

// How much better every season gets each level: 1%, compounding.
export const SEASON_LEVEL_UP = 0.01;

// Slots: bought once. A second tool to wear, a backup sprout, a second
// gadget, and a second season to mix with the first (v25).
export const SLOTS = {
  toolSlot: { price: 199 },
  sproutSlot: { price: 399 },
  gadgetSlot: { price: 99 },
  seasonSlot: { price: 299 },
};

// Used once: bought, then spent the first time they're used. You hold one
// of each at a time.
export const ONCE = {
  skip3: { price: 29, level: 3 },
  skip7: { price: 74, level: 7 },
  skip10: { price: 99, level: 10 },
  skip15: { price: 149, level: 15 },  // v29
  revive: { price: 49 },     // bought on the summary when the sprout is lost
};

// Timer mode (v26): no levels and no boss. Bacteria keep coming out of the
// pot's four corners, at the pace a level-5 boss sends them out (one every
// 3.125 seconds: bossSpawnEvery(5) in boss.js), until the clock runs out.
// Keep the sprout till then to win the run's prize, and to open the next run.
// Every 20 seconds they come 25% more often and crawl 25% faster: 25% of the
// starting pace more each time, added, not compounded (x1.25, x1.5, x1.75...;
// x4.5 in a 5-minute run's last 20 seconds, where compounding would make it x23).
// Special items appear from the start; the rest plays like level 1.
export const TIMER = {
  runs: {
    t1: { secs: 60, prize: 49 },
    t3: { secs: 180, prize: 179 },
    t5: { secs: 300, prize: 289, bluesAt: 60 },          // v29: blue bacteria come in its last minute
    t7: { secs: 420, prize: 369, bluesAt: 180, restAt: 60 }, // v29: blue in its last 3 minutes; the sprout's powers stop in its last
  },
  surgeEvery: 20,            // every 20 seconds...
  surge: 0.25,               // ...25% more often, and 25% faster
  corner: 12,                // they come out this far in from the rim, at a corner...
  spread: 0.12,              // ...give or take this much of a turn (radians)
  lap: 1.6,                  // time's up: the pot pops clean for this long before the summary
};

// A revive brings a lost sprout back with half its hearts, once a game, and
// only when there's no backup sprout left to carry on with. A revived sprout
// (or a backup sprout taking over) clears a little room.
export const REVIVE = { reach: 170, push: 80, perGame: 1 };

export const KNOCK_TIME = 0.35; // how long a spore push takes
export const ITEM_FLIGHT = 0.6; // a sunflower's item takes this long to land

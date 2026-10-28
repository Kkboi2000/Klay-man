# Klayman

A top-down, Snow Bros–style game. Throw dirt at bacteria, roll dirtballs into
them, and keep them out of the sprout. Plays on a phone (portrait or landscape)
or a computer, installs to the home screen, and works offline.

★ Krit’s vibe code ★

## Put it online with GitHub Pages

Every file sits in one folder, with no subfolders, so uploading is simple.

1. Create a repository on GitHub (yours is `Klay-man`).
2. Open it, click **Add file → Upload files**, select **all** the files in
   this folder, and commit. Uploading a file with the same name replaces it.
3. In **Settings → Pages**, choose **Deploy from a branch**, `main`, `/ (root)`.
4. After a minute the game is live at `https://<your-username>.github.io/Klay-man/`.
5. Open that link on your phone:
   - **iPhone (Safari):** Share → Add to Home Screen.
   - **Android (Chrome):** tap **Install** on the title screen, or menu → Install app.
   - **Opened from LINE?** LINE’s own browser can’t install apps. Tap
     **Open in your browser** on the title screen first.

### Updating

Upload the changed files the same way. Also open `sw.js` and bump `VERSION`
(`klayman-v18` → `klayman-v19`): phones keep an offline copy, and this is how
they know to fetch the new one.

## Pages

1. **Title:** Klayman’s face, over faded dirtballs rolling in from every side
   (two that meet break). Tap **Play**.
2. **Setup:** pick tools, a sprout and gadgets, buy things, switch **Auto
   throw**, then **Start**. The window at the top shows Klayman dressed for the
   game, his sprout's power, and his gadget at work.
3. **Game:** when the sprout is gone you see your score and the coins you
   picked up. With a backup sprout you can carry on with it; once there's no
   backup left, you can revive the sprout just lost for 49K: half its hearts
   back, and the game goes on at the same level with the same score. Once a
   game. Otherwise **Play again** or go back to **Setup**. Pause has
   **Setup** too.

**Sound** and **Music** each have their own switch, on the title page, the
setup page and the pause screen. Music is off until you switch it on, and
both are remembered between visits.

The title and setup pages open upright and a game opens sideways; turn the
phone and the screen follows. Only the installed app on Android can turn the
screen by itself. On an iPhone, or in a browser tab, the screen follows the
phone, and every page works either way.

## Coins and the shop

Coins are counted in K. A 1K coin appears somewhere on the soil every 30
seconds. Each bacteria you kill has a 4.5% chance to drop a 5K coin, and a
boss leaves a 10K coin. Every coin lasts 18 seconds and blinks for its last 3;
with the glasses on, arrows at the screen edge point to coins you can’t see.
Coins are saved the moment you pick them up.

On the setup page, tap something you don’t own, then tap again to buy it.

| Tool | Price | What it does |
| --- | --- | --- |
| Backpack | 19K | A coin magnet: coins within 300 (the brief’s 50 units) fly to Klayman, faster and faster. Worn on his back |
| Shoes | 29K | 15% faster; walks through the sprout |
| Gloves | 29K | Throws 15% faster and 15% farther, with three pixel streaks off the hand |
| Coat | 49K | Bacteria can’t get into Klayman; one that touches him crawls 30% slower for 5 s |
| Glasses | 69K | A light-blue visor: arrows to bacteria, the boss, items and coins off-screen; seconds left on items and coins; bacteria left this level; a ring wherever bacteria, an item, a coin or a boss will appear in the next 3 s (with a see-through picture of which item, or the coin); the boss’s HP; and the seconds until each gadget is ready |
| Dirt gun | 99K | Locks on to the closest thing it can hit (red brackets): a bacteria, the boss, or from level 7 a dirtball. Keeps Klayman facing it; throws, range and walking 5% up |

| Sprout | Price | What it does |
| --- | --- | --- |
| Sprout | free | 3 hearts, up to 7 with water drops (so can daisy, sunflower, rose and lilies) |
| Daisy | 99K | From level 1, every 30 s a coin pops out of the flower and lands nearby: 1K (80%), 5K (19%) or 10K (1%) |
| Sunflower | 149K | From level 1, every 30 s a glowing special item pops out of the flower and lands nearby. From level 3 the pot’s own items come too, so there can be one of each |
| Rose | 199K | Starts with 4 hearts; heals 1 heart every 20 s |
| Corn | 249K | 6 hearts, up to 11; every 40 s its leaves snap shut for 15 s (it darkens) and bacteria can’t get in |
| Lilies | 249K | Every 40 s its petals roll up into a bud for 15 s; bacteria lose sight of it and wander |
| Mushroom | 299K | Every 25 s spores push nearby bacteria and dirtballs 60 back; every bacteria in the ring gets one more layer of dirt (one on its third becomes a dirtball) and is slowed; heals half a heart every 30 s; grows 1 heart every 50 s, up to 9 |

| Gadget | Price | What it does |
| --- | --- | --- |
| Leaf | 39K | Three leaves spin out round Klayman (60, the brief’s 10 units); their wind pushes bacteria out and keeps them out for 5 s. Then 20 s to recharge |
| Mist spray | 39K | A bottle by the sprout sprays it twice: half a heart back. Then 20 s to recharge |
| Fertilizer | 39K | Every bacteria crawls 70% slower for 5 s. Then 20 s to recharge |

In a game, a gadget’s button sits bottom-left (of the game on a computer, of
the joystick pad on a phone). It fills up as the gadget recharges and turns
gold when it’s ready; with the glasses it also counts the seconds down. On a
computer, **G** uses the 1st gadget and **H** the 2nd.

| Slot | Price | What it does |
| --- | --- | --- |
| 2nd tool slot | 199K | Wear two tools. Tap a tool to put it on or take it off; a third swaps out the oldest |
| 2nd sprout slot | 399K | Pick a 1st and a 2nd sprout (the **1st / 2nd** buttons). When the 1st is lost, carry on with the 2nd |
| 2nd gadget slot | 99K | Take two gadgets into a game, the same way as tools |

| Level skip | Price | What it does |
| --- | --- | --- |
| Skip to level 3 / 7 / 10 | 29K / 74K / 99K | The next game starts there. Tap it to pick or unpick it; it’s spent when the game starts |

You hold one of each level skip at a time, and can buy it again after using
it. Tools, sprouts and slots are yours for good.

**Revive** isn’t on the setup page. When the sprout is lost and there’s no
backup sprout left to carry on with, the summary offers it for 49K: the sprout
just lost comes back with half the hearts it could hold (5 → 2.5), and the
game goes on at the same level, with the same score and the same bacteria.
Once a game.

All these numbers are in `config.js` (`COINS`, `TOOLS`, `SPROUTS`, `GADGETS`, `SLOTS`, `ONCE`, `REVIVE`).

## Boss bacteria

Levels 10, 15, 20, 25 and on end with a boss: a bacteria five times the size.
Once the level’s own bacteria are gone, the ground rumbles in one of the pot’s
four corners (never the one Klayman stands in) and the boss climbs out. It
never moves, and Klayman can’t walk through it. It sends a bacteria out of its
side every 2.5 s at level 10, 1.875 s at 15, 1.25 s at 20, and 1 s from 25 on.

It has level × 10 HP (100 at level 10, 150 at 15...). A throw takes 1 (1.5
with the bag) and a rolling dirtball 5. Only the glasses show its HP: a bar,
green, yellow from half, red from a fifth, with what’s left out of its full HP.
Worn out, it sags and sweats, burrows back into the ground, and a 10K coin pops
out where it stood (and 1,000 points). The level is cleared once it’s gone and
the bacteria it sent out are beaten too. A sandclock freezes it as well.

The numbers are in `config.js` (`BOSS`).

## Admin mode (for testing)

Tap Klayman’s face on the title page **5 times** (or open the game with
`?admin` on the end of the link). Admin mode uses its own save: everything is
unlocked and you start with 9,999K. The setup page then shows an admin panel:

- **+1,000K**, **Unlock all**, and **Lock all** (to try buying again).
- **Start at level** 1, 3, 7, 10, 15, 20 or 25: level 3 brings special items,
  level 7 the dirtball-breaking skill, and 10, 15, 20 and 25 a boss.
- **Leave admin mode** goes back to your own save, exactly as you left it.
  Coins, purchases and best score in admin mode never touch it.

Admin mode stays on (even after closing the app) until you leave it.

## Controls

Klayman aims all the way round, not just four ways.

- **Phone:** joystick on the left (he throws the way it points, and keeps
  aiming that way when you let go), the **K** button on the right: it throws
  (hold to keep throwing), and right up against a dirtball and facing it, it
  pushes it. The **Auto throw** switch (on the setup page, and in the
  bottom-right corner in a game) keeps Klayman throwing, and pushes a dirtball
  he walks into. Gadget buttons sit bottom-left.
- **Computer:** WASD or the arrow keys to move, the mouse to aim (the pointer
  becomes a sight). Click or Space to throw (or push, up against a dirtball);
  hold to keep throwing. G and H use the gadgets, P pauses.

The dirt gun aims for him, on whichever platform. A push only works when
Klayman is touching the dirtball. From level 7, dirt thrown at a dirtball
breaks it.

Bacteria are 5% faster again and every level spawns them 10% more often again
(`BACTERIA.speed`, `LEVELS.spawnRate`). A dirtball now takes 15% more dirt
(`BACTERIA.maxDirt`): five throws, or four with the bag.

## Changing how it feels

Every gameplay number is in `config.js`, with your original Godot values
noted. `FEEL` scales Klayman’s speed, his shots and dirtballs (1 = your exact
Godot numbers); bacteria use your original speed. `POT_SCALE` sets how big the
pot is: the camera follows Klayman, so you only see part of it. An arrow at the
screen edge points to the sprout when it’s off-screen (and, with the glasses,
to bacteria, items and coins).

## Files

| File | What it does |
| --- | --- |
| `klayman.js`, `bacteria.js`, `dirtball.js`, `dirtshot.js` | Ported from your `.gd` scripts |
| `items.js` | The four special items (a sunflower’s fly out of it, glowing), and coins (a daisy’s and a boss’s fly out too; the backpack pulls them in) |
| `boss.js` | The boss bacteria: where it stands, HP, rising, tiring and burrowing |
| `gadgets.js` | A gadget’s clock: ready, working, recharging (what each does is in `game.js`) |
| `gear.js` | Tools, sprouts, gadgets, slots and used-once items: names, what they change, and the saved wallet |
| `setup.js` | The setup page and the title face |
| `titleballs.js` | The dirtballs rolling behind the title |
| `orientation.js` | Which way round the screen opens, and following the phone after that |
| `art.js` | Pixel art drawn in code: sprouts (open and closed), tool, gadget and shop icons, coin, dirt guns, the backpack as worn, a gadget leaf, the mist bottle |
| `game.js` | Rules: levels, spawning, collisions, score |
| `world.js` | The pot: soil edge, sprout spot, where items appear |
| `render.js`, `sprites.js` | Drawing and sprite-sheet frames; shoes, gloves, coat and glasses are painted onto Klayman’s frames the first time they’re worn; the gun and backpack are drawn on him |
| `input.js`, `sound.js`, `ui.js`, `main.js` | Controls, sound, screens, start-up |
| `sw.js`, `manifest.webmanifest` | Offline play and home-screen install |
| `klay-digits.woff2`, `klay-digits-bold.woff2` | The numbers 0–9, drawn for this game so 2 and 5 never read as 8 and S |
| `make-digits.py` | Builds those two files: edit a digit’s pixels there and run it (`pip install fonttools brotli`) |
| `game.test.js`, `gear.test.js`, `boss.test.js`, `orientation.test.js` | Rule checks: run `npm test` (needs Node 18+) |

The sound effects were trimmed to remove the silence at the start of each
file, so they play the moment something happens, and every effect plays at
half volume (`EFFECTS_VOLUME` in `sound.js`). The gun, coin, shop and
sunflower sounds are made in code (`sound.js`). The music is `music.mp3`, an
8.8-second loop; `sound.js` finds where it really starts and ends, so it
loops without a click.

The app icon is Klayman’s head, cut from the same frame as the title face.

Font: Pixelify Sans, SIL Open Font License (`OFL.txt`). The digits are the
game’s own (Klay Digits), on Pixelify’s pixel grid.

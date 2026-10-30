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
(`klayman-v24` → `klayman-v25`): phones keep an offline copy, and this is how
they know to fetch the new one.

## Pages

1. **Title:** Klayman’s face, over faded dirtballs rolling in from every side
   (two that meet break). Tap **Play**.
2. **Setup:** two doors, **Klayman** and **Plant**, each saying what's picked
   behind it, then **Slots**, **Level skips**, **Orientation** and **Auto
   throw**. Klayman's page has two tabs, **Tools** and **Gadgets**; the
   plant's has **Sprouts** and **Seasons**. **‹ Setup** (or the phone's back
   gesture, or Esc) comes back. Pick, buy, then **Start**, from any of the
   three.

   The window into the pot: on setup's own page it's wide and shows the game
   you'll play (Klayman dressed for it, by his sprout, his gadget at work,
   the pot in its season). On Klayman's and the plant's pages it's square,
   stays in view while the list scrolls under it, and shows just Klayman, or
   just the sprout (the mist spray works on the sprout, so it shows the
   sprout, with Klayman peeking in at the edge). There, **tap anything to see
   it at work, bought or not**: what you own goes on, what you don't is tried
   on. Tap it again to buy it. Every few seconds the little scene starts
   over, so a sprout's power, a gadget, the summer sun or a lightning bolt
   comes round again. The window takes in more of the pot for the leaf and
   the shovel, whose rings are also drawn 30% smaller there (`preview` in
   `config.js`).
3. **Game:** when the sprout is gone you see your score and the coins you
   picked up. With a backup sprout you can carry on with it; once there's no
   backup left, you can revive the sprout just lost for 49K: half its hearts
   back, and the game goes on at the same level with the same score. Once a
   game. Otherwise **Play again** or go back to **Setup**. Pause has
   **Setup** too.

**Sound** and **Music** each have their own switch, on the title page, the
setup page and the pause screen. Music is off until you switch it on, and
both are remembered between visits.

**Orientation** (v24): the title and setup pages are always upright. A game
is sideways (**Landscape**) unless you pick **Portrait**, on the setup page
or in pause (switching in pause turns the game on the spot). Tilting the
phone never turns anything. The installed app on Android locks the screen.
An iPhone, or a browser tab, can't be locked, so when the phone holds the
screen the wrong way round the page turns itself a quarter turn instead: a
sideways game on an upright phone is turned so you turn the phone to the
left to play, and the joystick, K button and every tap follow the turn. On a
computer nothing turns, and there's no orientation to pick.

## Coins and the shop

Coins are counted in K. A 1K coin appears somewhere on the soil every 30
seconds. Each bacteria you kill has a 4.5% chance to drop a 5K coin, and a
boss leaves a 10K coin. Every coin lasts 18 seconds and blinks for its last 3;
with the glasses on, arrows at the screen edge point to coins you can’t see.
Coins are saved the moment you pick them up.

On the setup page, tap something you don’t own, then tap again to buy it. On
Klayman’s and the plant’s pages the first tap also tries it on in the window,
so you see it at work before you pay (even when you can’t afford it yet).

| Tool | Price | What it does |
| --- | --- | --- |
| Backpack | 19K | A coin magnet: coins within 150 (the brief’s 25 units) fly to Klayman, faster and faster. Worn on his back |
| Shoes | 29K | 15% faster; walks through the sprout |
| Gloves | 29K | Throws 15% faster and 15% farther, with three pixel streaks off the hand |
| Coat | 49K | Bacteria can’t get into Klayman; one that touches him crawls 30% slower for 5 s |
| Glasses | 69K | A light-blue visor: arrows to bacteria, the boss, items and coins off-screen; seconds left on items and coins; bacteria left this level; a ring wherever bacteria, an item, a coin or a boss will appear in the next 3 s (with a see-through picture of which item, or the coin); the boss’s HP; the seconds until the sprout’s next power (above the sprout); the seconds until each gadget is ready; and in the rainy season, a ring and a bolt on what lightning will strike, 2 s before it does |
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
| Leaf | 39K | Three leaves spin out round Klayman (150, the brief’s 25 units); their wind pushes bacteria out and keeps them out for 5 s. Then 15 s to recharge |
| Mist spray | 39K | A bottle by the sprout sprays it twice in 0.75 s: half a heart back. Then 15 s to recharge |
| Fertilizer | 39K | Every bacteria crawls 70% slower for 5 s. Then 15 s to recharge |
| Shovel | 39K | Klayman stops and digs for 0.75 s, the shovel swinging above his head; light-brown dirt flies over a ring 252 round him (42 units: v22's 60, 30% smaller), and every bacteria in it gets two more layers of dirt (one already dirty enough becomes a dirtball). Dirtballs don’t mind. Then 15 s to recharge |
| Booster | 39K | For 4 s Klayman turns red, a little bigger and glowing: he throws 2.5 times as fast and as far, walks 2.5 times as fast, and his dirt counts 2.5 times (two throws to a dirtball; 2.5 on a boss too). The setup page says twice, on purpose: the real thing is a little stronger than it promises. Then he turns grey for 2 s: all four drop to half. Then 15 s to recharge. It stacks with gloves and medicine (booster and medicine together: still two throws to a dirtball). It was the hypodermic syringe; one bought before keeps working |

In a game, a gadget’s button sits in the top-right corner, under the hearts
and the pause button. It fills up as the gadget recharges and turns
gold when it’s ready; with the glasses it also counts the seconds down. On a
computer, **G** uses the 1st gadget and **H** the 2nd.

| Season | Price | What it does (never to a boss; the bacteria it sends out do feel it) |
| --- | --- | --- |
| Summer | 169K | The pot is brighter, and the sprout wears tiny sunglasses low on its stem. Every 50 s the sun spotlights the sprout and it grows half a heart, up to 2 hearts more; then the sun stops. It raises the sprout's limit too, so water drops still grow it |
| Winter | 169K | The pot is a little blue. Every bacteria crawls 15% slower |
| Spring | 169K | A breeze blows across now and then, with petals in it, and tiny stars twinkle as they fly round the sprout. Every sprout power (coins, items, healing, spores, growing, closing) comes round 15% sooner (its wait is 85% as long: a rose heals every 17 s, not 20); how long it lasts doesn't change |
| Autumn | 169K | Big trees round the pot shade its edges, and leaves drift down; a fallen leaf sticks to every dirtball, somewhere random, and flutters up and away when the ball is pushed. Dirtballs take 2.5 times as long to crack open (the setup page says twice, on purpose, like the booster), and dirt takes 50% longer to wear off a bacteria |
| Rainy | 169K | A light rain falls. Every minute lightning strikes whatever is nearest Klayman, so you see it. A bacteria dies on the spot (100 points); a dirtball rolls straight at the closest bacteria, or, with none about, into the pot's rim. It picks its target 2 s early, and the glasses mark it; if that one is beaten first, the next nearest is marked instead |

**Every season gets 1% better each level**, compounding: the sun and the
lightning come 1% sooner, winter's bacteria are 1% slower still, spring's
waits 1% shorter, and autumn's dirtballs and dirt hold on 1% longer. At level
25 that's about 21% sooner or slower, or 27% longer, than at level 1.

Seasons are bought once and kept. Pick one on the setup page (Plant, then
Seasons), or **No season**; the pick is remembered. The numbers are in
`config.js` (`SEASONS`, level 1's, and `SEASON_LEVEL_UP`); `storm.strikes` is
how many things lightning hits each minute (1), and `storm.warn` how early it
picks them (2 s).

| Slot | Price | What it does |
| --- | --- | --- |
| 2nd tool slot | 199K | Wear two tools. Tap a tool to put it on or take it off; a third swaps out the oldest |
| 2nd sprout slot | 399K | Pick a 1st and a 2nd sprout (the **1st / 2nd** buttons). When the 1st is lost, carry on with the 2nd |
| 2nd gadget slot | 99K | Take two gadgets into a game, the same way as tools |

| Level skip | Price | What it does |
| --- | --- | --- |
| Skip to level 3 / 7 / 10 | 29K / 74K / 99K | The next game starts there. Tap it to pick or unpick it; it’s spent when the game starts |

You hold one of each level skip at a time, and can buy it again after using
it. Tools, sprouts, gadgets, seasons and slots are yours for good.

**Revive** isn’t on the setup page. When the sprout is lost and there’s no
backup sprout left to carry on with, the summary offers it for 49K: the sprout
just lost comes back with half the hearts it could hold (5 → 2.5), and the
game goes on at the same level, with the same score and the same bacteria.
Once a game.

All these numbers are in `config.js` (`COINS`, `TOOLS`, `SPROUTS`, `GADGETS`, `SLOTS`, `ONCE`, `REVIVE`).

## Special items

From level 3 they appear near the sprout (from level 1 out of a sunflower),
one at a time, for 20 s. Walk over one to use it: a **red plus** gives the
sprout a heart back, a **water drop** grows it a heart bigger, a
**sandclock** freezes the bacteria for 5 s, and **medicine** (a red and white
capsule; it was a bag until v22) powers Klayman up
for 5.5 s: he throws and walks 27.5% faster and his dirt counts 1.5 times
(three throws to a dirtball). In v21 its time and its raises were cut by
45% (it was 10 s and 50%); it never changed how far he throws. The numbers
are in `config.js` (`ITEMS`).

## Boss bacteria

Levels 5, 10, 15, 20 and on end with a boss: a bacteria four times the size,
darker and meaner, drawn on the same pixel grid as everything else
(`boss.png`, made by `make-boss.py`). Once the level’s own bacteria are gone,
the ground rumbles right in one of the pot’s four corners (never the one
Klayman stands in) and the boss climbs out. It never moves, and Klayman can’t
walk through it. It sends a bacteria out of its side every 3.125 s at level 5,
2.5 s at 10, 1.875 s at 15, 1.25 s at 20, and 1 s from 25 on.

It has level × 10 HP (50 at level 5, 100 at 10...). A throw takes 1 (1.5
with medicine, 2.5 with the booster) and a rolling dirtball 5. While a boss is out, thrown dirt flies
past dirtballs instead of breaking them (and the dirt gun leaves them be):
they’re for pushing into the boss. Only the glasses show its HP: a bar,
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
- **Start at level** 1, 3, 5, 7, 10, 15, 20 or 25: level 3 brings special
  items, level 7 the dirtball-breaking skill, and 5, 10, 15, 20 and 25 a boss.
- **Leave admin mode** goes back to your own save, exactly as you left it.
  Coins, purchases and best score in admin mode never touch it.

Admin mode stays on (even after closing the app) until you leave it.

## Controls

Klayman aims all the way round, not just four ways.

- **Phone:** the game fills the whole screen and the controls float over it,
  see-through (40%). Touch the left half and the joystick comes to your thumb
  (he walks the way it points, and throws that way too). Touch the right half
  and the **K** button does: it throws (hold to keep throwing), and right up
  against a dirtball and facing it, it pushes it. K is an aiming stick as
  well: drag it and Klayman aims that way, all the way round (a short dotted
  line shows where); press it without dragging and he aims at the closest
  bacteria. Let go and he keeps aiming that way until he walks. The **Auto
  throw** switch (on the setup page, and at the top middle in a game; held
  upright, just under the hearts) keeps Klayman throwing, and pushes a
  dirtball he walks into. Gadget buttons and pause sit top right.
- **Computer:** WASD or the arrow keys to move, the mouse to aim (the pointer
  becomes a sight). Click or Space to throw (or push, up against a dirtball);
  hold to keep throwing. G and H use the gadgets, P pauses.

The dirt gun aims for him, on whichever platform: it wins over the K stick
and the mouse. A push only works when Klayman is touching the dirtball, and
it rolls exactly the way he aims, at any angle. From level 7, dirt thrown at a
dirtball breaks it.

Bacteria crawl 3% slower than in v18 and every level spawns them 6% less often
(`BACTERIA.speed`, `LEVELS.spawnRate`). A dirtball takes 10% less dirt than in
v18 (`BACTERIA.maxDirt`, 4.14): throws are whole, so that's still five plain
throws, but three with medicine instead of four. A bacteria on its third layer
of dirt is always one throw away.

## Changing how it feels

Every gameplay number is in `config.js`, with your original Godot values
noted. `FEEL` scales Klayman’s speed, his shots and dirtballs (1 = your exact
Godot numbers); bacteria use your original speed. `POT_SCALE` sets how big the
pot is: the camera follows Klayman, so you only see part of it. Since v22 the
pot is seen from straight above, a perfect circle (`bg.png`, drawn by
`make-pot.py`), and every ring on the soil (leaf, shovel, spores) is round
too. With the glasses, arrows at the screen edge point to bacteria, items and
coins off-screen. (Since v24 there's no arrow to the sprout: it never moves.)

## Files

| File | What it does |
| --- | --- |
| `klayman.js`, `bacteria.js`, `dirtball.js`, `dirtshot.js` | Ported from your `.gd` scripts |
| `items.js` | The four special items: red plus, medicine, water drop and sandclock (a sunflower’s fly out of it, glowing), and coins (a daisy’s and a boss’s fly out too; the backpack pulls them in) |
| `boss.js` | The boss bacteria: where it stands, HP, rising, tiring and burrowing |
| `boss.png`, `make-boss.py` | The boss's frames (four fighting, two worn out), drawn by the script: edit and run it (`pip install pillow`) |
| `bg.png`, `make-pot.py` | The round pot seen from above, drawn by the script the same way. Change its sizes and `world.js` must match |
| `weather.js` | How each season looks: summer's light and sun, winter's blue, spring's breeze, autumn's tree shade and leaves, rain and lightning (what they do is in `game.js`) |
| `gadgets.js` | A gadget’s clock: ready, working, recharging (what each does is in `game.js`) |
| `gear.js` | Tools, sprouts, gadgets, seasons, slots and used-once items: names, what they change, and the saved wallet |
| `setup.js` | The setup page (its tabs, and the window that tries things on) and the title face |
| `titleballs.js` | The dirtballs rolling behind the title |
| `orientation.js` | Which way round each page is shown: the lock, or the page's own quarter turn, and touches turned to match |
| `art.js` | Pixel art drawn in code: sprouts (open and closed), tool, gadget, season and shop icons, coin, dirt guns, the backpack as worn, a gadget leaf, the mist bottle, summer's sunglasses, autumn's dirtball leaf, the glasses' lightning bolt |
| `game.js` | Rules: levels, spawning, collisions, score |
| `world.js` | The pot: soil edge, sprout spot, where items appear |
| `render.js`, `sprites.js` | Drawing and sprite-sheet frames; shoes, gloves, coat and glasses are painted onto Klayman’s frames the first time they’re worn; the gun and backpack are drawn on him |
| `input.js`, `sound.js`, `ui.js`, `main.js` | Controls, sound, screens, start-up |
| `sw.js`, `manifest.webmanifest` | Offline play and home-screen install |
| `klay-digits.woff2`, `klay-digits-bold.woff2` | The numbers 0–9, drawn for this game so 2 and 5 never read as 8 and S |
| `make-digits.py` | Builds those two files: edit a digit’s pixels there and run it (`pip install fonttools brotli`) |
| `game.test.js`, `gear.test.js`, `boss.test.js`, `season.test.js`, `orientation.test.js` | Rule checks: run `npm test` (needs Node 18+) |

The sound effects were trimmed to remove the silence at the start of each
file, so they play the moment something happens, and every effect plays at
half volume (`EFFECTS_VOLUME` in `sound.js`). The gun, coin, shop and
sunflower sounds are made in code (`sound.js`). The music is `music.mp3` (v22's new
track), a 9-second loop; `sound.js` finds where it really starts and ends, so it
loops without a click.

The app icon is Klayman’s head, cut from the same frame as the title face.

Font: Pixelify Sans, SIL Open Font License (`OFL.txt`). The digits are the
game’s own (Klay Digits), on Pixelify’s pixel grid.

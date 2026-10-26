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
(`klayman-v16` → `klayman-v17`): phones keep an offline copy, and this is how
they know to fetch the new one.

## Pages

1. **Title:** Klayman’s face, over faded dirtballs rolling in from every side
   (two that meet break). Tap **Play**.
2. **Setup:** pick tools and a sprout, buy things, switch **Auto throw**, then
   **Start**. The window at the top shows Klayman dressed for the game.
3. **Game:** when the sprout is gone you see your score and the coins you
   picked up. With a backup sprout you can carry on with it; once there's no
   backup left, you can revive the sprout for 49K (half its hearts back), once
   a game. Otherwise **Play again** or go back to **Setup**. Pause has
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
seconds. Each bacteria you kill has a 4.5% chance to drop a 5K coin. Every coin
lasts 18 seconds and blinks for its last 3; with the glasses on, arrows at the
screen edge point to coins you can’t see. Coins are saved the moment you pick
them up.

On the setup page, tap something you don’t own, then tap again to buy it.

| Tool | Price | What it does |
| --- | --- | --- |
| Shoes | 29K | 15% faster; walks through the sprout |
| Gloves | 29K | Throws 15% faster and 15% farther, with three pixel streaks off the hand |
| Coat | 49K | Bacteria can’t get into Klayman; one that touches him crawls 30% slower for 5 s |
| Glasses | 69K | A light-blue visor: arrows to bacteria, items and coins off-screen; seconds left on items and coins; bacteria left this level; and a ring wherever bacteria will appear in the next 3 s, or an item (with a see-through picture of which one) |
| Dirt gun | 99K | Locks on to the closest bacteria (red brackets) and keeps Klayman facing it; throws, range and walking 5% up |

| Sprout | Price | What it does |
| --- | --- | --- |
| Sprout | free | 3 hearts, up to 7 with water drops (so can sunflower, rose and lilies) |
| Sunflower | 149K | Every 35 s a special item pops out of the flower and lands nearby |
| Rose | 199K | Starts with 4 hearts; heals 1 heart every 20 s |
| Corn | 249K | 6 hearts, up to 11; every 40 s its leaves snap shut for 15 s (it darkens) and bacteria can’t get in |
| Lilies | 249K | Every 40 s its petals roll up into a bud for 15 s; bacteria lose sight of it and wander |
| Mushroom | 299K | Every 25 s spores push nearby bacteria 60 back and slow them; heals half a heart every 30 s; grows 1 heart every 50 s, up to 9 |

| Slot | Price | What it does |
| --- | --- | --- |
| 2nd tool slot | 499K | Wear two tools. Tap a tool to put it on or take it off; a third swaps out the oldest |
| 2nd sprout slot | 999K | Pick a 1st and a 2nd sprout (the **1st / 2nd** buttons). When the 1st is lost, carry on with the 2nd |

| Level skip | Price | What it does |
| --- | --- | --- |
| Skip to level 3 / 7 / 10 | 29K / 74K / 99K | The next game starts there. Tap it to pick or unpick it; it’s spent when the game starts |

You hold one of each level skip at a time, and can buy it again after using
it. Tools, sprouts and slots are yours for good.

**Revive** isn’t on the setup page. When the sprout is lost and there’s no
backup sprout left to carry on with, the summary offers it for 49K: the sprout
comes back with half the hearts it could hold (5 → 2.5). Once a game.

All these numbers are in `config.js` (`COINS`, `TOOLS`, `SPROUTS`, `SLOTS`, `ONCE`, `REVIVE`).

## Admin mode (for testing)

Tap Klayman’s face on the title page **5 times** (or open the game with
`?admin` on the end of the link). Admin mode uses its own save: everything is
unlocked and you start with 9,999K. The setup page then shows an admin panel:

- **+1,000K**, **Unlock all**, and **Lock all** (to try buying again).
- **Start at level** 1, 3, 7 or 10: level 3 brings special items, level 7 the
  dirtball-breaking skill.
- **Leave admin mode** goes back to your own save, exactly as you left it.
  Coins, purchases and best score in admin mode never touch it.

Admin mode stays on (even after closing the app) until you leave it.

## Controls

- **Phone:** joystick on the left, throw on the right (hold to keep throwing).
  Right up against a dirtball and facing it, the same button pushes it. The
  **Auto throw** switch (on the setup page, and in the bottom-right corner in a
  game) keeps Klayman throwing, and pushes a dirtball he walks into.
- **Computer:** arrow keys or WASD to move, Space to throw, K to push, P to pause.

A push only works when Klayman is touching the dirtball. From level 7, dirt
thrown at a dirtball breaks it.

Bacteria are 5% faster than before and every level spawns them 10% more often
(`BACTERIA.speed`, `LEVELS.spawnRate`).

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
| `items.js` | The four special items (a sunflower’s fly out of it), and coins |
| `gear.js` | Tools, sprouts, slots and used-once items: names, what they change, and the saved wallet |
| `setup.js` | The setup page and the title face |
| `titleballs.js` | The dirtballs rolling behind the title |
| `orientation.js` | Which way round the screen opens, and following the phone after that |
| `art.js` | Pixel art drawn in code: sprouts (open and closed), tool and shop icons, coin, dirt guns |
| `game.js` | Rules: levels, spawning, collisions, score |
| `world.js` | The pot: soil edge, sprout spot, where items appear |
| `render.js`, `sprites.js` | Drawing and sprite-sheet frames; shoes, gloves, coat and glasses are painted onto Klayman’s frames the first time they’re worn |
| `input.js`, `sound.js`, `ui.js`, `main.js` | Controls, sound, screens, start-up |
| `sw.js`, `manifest.webmanifest` | Offline play and home-screen install |
| `klay-digits.woff2`, `klay-digits-bold.woff2` | The numbers 0–9, drawn for this game so 2 and 5 never read as 8 and S |
| `make-digits.py` | Builds those two files: edit a digit’s pixels there and run it (`pip install fonttools brotli`) |
| `game.test.js`, `gear.test.js`, `orientation.test.js` | Rule checks: run `npm test` (needs Node 18+) |

The sound effects were trimmed to remove the silence at the start of each
file, so they play the moment something happens. The gun, coin, shop and
sunflower sounds are made in code (`sound.js`). The music is `music.mp3`, an
8.8-second loop; `sound.js` finds where it really starts and ends, so it
loops without a click.

The app icon is Klayman’s head, cut from the same frame as the title face.

Font: Pixelify Sans, SIL Open Font License (`OFL.txt`). The digits are the
game’s own (Klay Digits), on Pixelify’s pixel grid.

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
(`klayman-v11` → `klayman-v12`): phones keep an offline copy, and this is how
they know to fetch the new one.

## Pages

1. **Title:** Klayman’s face. Tap **Play**.
2. **Setup:** pick a tool and a sprout, switch **Auto throw**, then **Start**.
   The window at the top shows Klayman dressed for the game.
3. **Game:** when the sprout is gone you see your score and the coins you
   picked up, then **Play again** or go back to **Setup**. Pause has **Setup** too.

## Coins and the shop

Coins are counted in K. A 1K coin appears somewhere on the soil every 27
seconds. Each bacteria you kill has a 5% chance to drop a 5K coin. Every coin
lasts 15 seconds and blinks for its last 3; arrows at the screen edge point to
coins you can’t see. Coins are saved the moment you pick them up.

On the setup page, tap something you don’t own, then tap again to buy it.
You keep it for good. Klayman wears one tool per game.

| Tool | Price | What it does |
| --- | --- | --- |
| Shoes | 29K | 10% faster; walks through the sprout |
| Gloves | 29K | Throws 10% faster and 10% farther, with a gust at the arm |
| Lab coat | 49K | Bacteria can’t get into Klayman |
| Dirt gun | 99K | Locks on to the closest bacteria (red brackets) and keeps Klayman facing it; shots hit from any angle; 20% faster and farther; gun sound |

| Sprout | Price | What it does |
| --- | --- | --- |
| Sprout | free | 3 hearts, up to 7 with water drops (so can sunflower and rose) |
| Sunflower | 149K | Special items every 20 seconds instead of 60 |
| Corn | 199K | Starts with 6 hearts, and stays at 6 |
| Rose | 249K | Heals 1 heart every 30 seconds |
| Mushroom | 299K | Every 40 s, spores push crawling bacteria back and slow them for 4 s; every 80 s it grows 1 heart, up to 9 |

All these numbers are in `config.js` (`COINS`, `TOOLS`, `SPROUTS`).

## Controls

- **Phone:** joystick on the left, throw on the right (hold to keep throwing).
  The **Auto throw** switch (on the setup page, and under the throw button)
  keeps Klayman throwing on his own; it never pushes dirtballs, so tap the throw button for that.
- **Computer:** arrow keys or WASD to move, Space to throw, P to pause.

Facing a dirtball up close, the throw button pushes it instead. From level 7,
dirt thrown at a dirtball from a distance breaks it.

## Changing how it feels

Every gameplay number is in `config.js`, with your original Godot values
noted. `FEEL` scales Klayman’s speed, his shots and dirtballs (1 = your exact
Godot numbers); bacteria use your original speed. `POT_SCALE` sets how big the
pot is: the camera follows Klayman, so you only see part of it, and
arrows at the screen edge point to bacteria, items and the sprout off-screen.

## Files

| File | What it does |
| --- | --- |
| `klayman.js`, `bacteria.js`, `dirtball.js`, `dirtshot.js` | Ported from your `.gd` scripts |
| `items.js` | The four special items, and coins |
| `gear.js` | Tools and sprouts: names, what they change, and the saved wallet |
| `setup.js` | The setup page and the title face |
| `art.js` | Pixel art drawn in code: sprouts, tool icons, coin, dirt gun |
| `game.js` | Rules: levels, spawning, collisions, score |
| `world.js` | The pot: soil edge, sprout spot, where items appear |
| `render.js`, `sprites.js` | Drawing and sprite-sheet frames; shoes, gloves and coat are painted onto Klayman’s frames when the game loads |
| `input.js`, `sound.js`, `ui.js`, `main.js` | Controls, sound, screens, start-up |
| `sw.js`, `manifest.webmanifest` | Offline play and home-screen install |
| `game.test.js`, `gear.test.js` | Rule checks: run `npm test` (needs Node 18+) |

The sound effects were trimmed to remove the silence at the start of each
file, so they play the moment something happens. The gun, coin and shop
sounds are made in code (`sound.js`), so there are no new sound files.

Font: Pixelify Sans, SIL Open Font License (`OFL.txt`).

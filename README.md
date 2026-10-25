# Klayman

A top-down, Snow Bros–style game. Throw dirt at bacteria, roll dirtballs into
them, and keep them out of the sprout. Plays on a phone (portrait or landscape)
or a computer, installs to the home screen, and works offline.

★ Krit’s vibe code ★

## Put it online with GitHub Pages

1. Create a new repository on GitHub (for example `klayman`).
2. Upload everything in this folder to it, keeping the folders as they are.
3. In the repository, open **Settings → Pages**. Under "Build and deployment",
   choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
4. After a minute the game is live at `https://<your-username>.github.io/klayman/`.
5. Open that link on your phone:
   - **iPhone (Safari):** Share → Add to Home Screen.
   - **Android (Chrome):** tap **Install** on the title screen, or menu → Install app.

### Updating

After changing any file, open `sw.js` and bump `VERSION`
(`klayman-v1` → `klayman-v2`). Phones keep an offline copy, and this is how
they know to fetch the new one.

## Controls

- **Phone:** joystick on the left, throw on the right (hold to keep throwing).
  The **Auto throw** switch under the throw button keeps Klayman throwing on
  his own; it never pushes dirtballs, so tap the throw button for that.
- **Computer:** arrow keys or WASD to move, Space to throw, P to pause.

Facing a dirtball up close, the throw button pushes it instead. From level 7,
dirt thrown at a dirtball from a distance breaks it.

## Changing how it feels

Every gameplay number is in `js/config.js`, with your original Godot values
noted. `FEEL` scales Klayman’s speed, his shots and dirtballs (1 = your exact
Godot numbers); bacteria use your original speed. `POT_SCALE` sets how big the
pot is: the camera follows Klayman, so you only see part of it, and
arrows at the screen edge point to bacteria, items and the sprout off-screen.

## Files

| File | What it does |
| --- | --- |
| `js/klayman.js`, `bacteria.js`, `dirtball.js`, `dirtshot.js` | Ported from your `.gd` scripts |
| `js/items.js` | The four special items |
| `js/game.js` | Rules: levels, spawning, collisions, score |
| `js/world.js` | The pot: soil edge, sprout spot, where items appear |
| `js/render.js`, `sprites.js` | Drawing and sprite-sheet frames |
| `js/input.js`, `sound.js`, `ui.js`, `main.js` | Controls, sound, screens, start-up |
| `sw.js`, `manifest.webmanifest` | Offline play and home-screen install |
| `tests/game.test.js` | Rule checks: run `npm test` (needs Node 18+) |

The sound effects were trimmed to remove the silence at the start of each
file, so they play the moment something happens.

Font: Pixelify Sans, SIL Open Font License (`assets/fonts/OFL.txt`).

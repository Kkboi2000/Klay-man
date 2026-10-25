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
(`klayman-v9` → `klayman-v10`): phones keep an offline copy, and this is how
they know to fetch the new one.

## Controls

- **Phone:** joystick on the left, throw on the right (hold to keep throwing).
  The **Auto throw** switch under the throw button keeps Klayman throwing on
  his own; it never pushes dirtballs, so tap the throw button for that.
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
| `items.js` | The four special items |
| `game.js` | Rules: levels, spawning, collisions, score |
| `world.js` | The pot: soil edge, sprout spot, where items appear |
| `render.js`, `sprites.js` | Drawing and sprite-sheet frames |
| `input.js`, `sound.js`, `ui.js`, `main.js` | Controls, sound, screens, start-up |
| `sw.js`, `manifest.webmanifest` | Offline play and home-screen install |
| `game.test.js` | Rule checks: run `npm test` (needs Node 18+) |

The sound effects were trimmed to remove the silence at the start of each
file, so they play the moment something happens.

Font: Pixelify Sans, SIL Open Font License (`OFL.txt`).

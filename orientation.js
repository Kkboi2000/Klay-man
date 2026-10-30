// Which way round each page is shown (v24). The title and setup pages are
// always upright. A game is sideways unless the player picks upright, on the
// setup page or in pause. Tilting the phone never turns anything.
//
// Where the screen can be locked (an installed app on Android), it's locked.
// Elsewhere (an iPhone, a browser tab) the phone turns the screen when it's
// turned, so a page that comes out the wrong way round is turned a quarter
// turn in CSS (#app[data-turn]), and touches are turned back to match it
// (point, rect). On a computer nothing is turned.

export const GAME_WAYS = ['landscape', 'portrait'];
const KEY = 'klayman.orientation';

/** The way a page is shown: a game the player's way, every other page upright. */
export function wayFor(inGame, gameWay) {
  return inGame ? gameWay : 'portrait';
}

/** How far to turn the page, in degrees clockwise (0, 90 or -90), so that
 *  a screen `w` x `h` shows `want`. `angle` is how far the phone has turned
 *  the screen from its own upright (screen.orientation.angle).
 *
 *  Wanted upright but the screen is wide: the phone is held sideways, so the
 *  page is turned back to line up with the phone (and you turn it upright).
 *  Wanted sideways but the screen is tall: the phone is held upright, so the
 *  page is turned clockwise, and you turn the phone a quarter to the left to
 *  play (the way most phone games go). */
export function turnFor(want, w, h, angle = 0) {
  const shape = w > h ? 'landscape' : 'portrait';
  if (shape === want) return 0;
  const a = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  if (want === 'portrait') return a === 270 ? 90 : -90;
  return a === 180 ? -90 : 90;
}

/** A point on the screen (clientX, clientY) as a point on the page turned
 *  by `turn`, for a screen `w` x `h`. */
export function toLocal(turn, w, h, x, y) {
  if (turn === 90) return { x: y, y: w - x };
  if (turn === -90) return { x: h - y, y: x };
  return { x, y };
}

function loadWay() {
  try {
    const saved = localStorage.getItem(KEY);
    if (GAME_WAYS.includes(saved)) return saved;
  } catch { /* nothing saved */ }
  return 'landscape';
}

/** `handheld`: a phone or tablet (the only place a page is turned).
 *  `onChange`: lay the page out again (the way, or the turn, changed). */
export function createOrientation({ handheld = false, onChange = () => {} } = {}) {
  const screenWay = globalThis.screen?.orientation;
  let canLock = handheld && typeof screenWay?.lock === 'function';
  let pending = false;             // a lock asked for and not answered yet
  let wanted = null;               // nothing asked for yet: the first page's ask always counts
  let gameWay = loadWay();
  let turn = 0;

  const view = () => ({ w: globalThis.innerWidth || 1, h: globalThis.innerHeight || 1 });
  const angle = () => screenWay?.angle ?? Number(globalThis.orientation ?? 0);

  function lock(kind) {
    if (!canLock) return;
    pending = true;
    // A browser tab or an iPhone says no; from then on the page turns itself.
    screenWay.lock(kind).catch(() => { canLock = false; }).finally(() => {
      pending = false;
      onChange();
    });
  }

  return {
    get gameWay() { return gameWay; },
    get wanted() { return wanted ?? 'portrait'; },

    /** A page asks to be shown `kind` ('portrait' or 'landscape'). */
    want(kind) {
      if (kind === wanted) return;
      wanted = kind;
      lock(kind);
      onChange();
    },

    /** The player picks how a game is shown. Remembered between visits. */
    setGameWay(kind) {
      if (!GAME_WAYS.includes(kind)) return;
      gameWay = kind;
      try { localStorage.setItem(KEY, kind); } catch { /* private mode */ }
    },

    /** Works out the turn for the screen as it is now (0 while a lock is
     *  on its way: the phone is about to turn the screen itself). */
    measure() {
      const { w, h } = view();
      turn = handheld && !pending ? turnFor(wanted ?? 'portrait', w, h, angle()) : 0;
      return { turn, w: turn ? h : w, h: turn ? w : h, viewW: w, viewH: h };
    },

    get turn() { return turn; },

    /** Where a pointer event is, on the page. */
    point(e) {
      const { w, h } = view();
      return toLocal(turn, w, h, e.clientX, e.clientY);
    },

    /** An element's box, on the page (getBoundingClientRect, turned back). */
    rect(el) {
      const r = el.getBoundingClientRect();
      if (!turn) return { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom };
      const { w, h } = view();
      const a = toLocal(turn, w, h, r.left, r.top);
      const b = toLocal(turn, w, h, r.right, r.bottom);
      const left = Math.min(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const bottom = Math.max(a.y, b.y);
      return { left, top, width: Math.max(a.x, b.x) - left, height: bottom - top, bottom };
    },
  };
}

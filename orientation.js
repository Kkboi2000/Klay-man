// Which way round the screen is. The title and setup pages open upright; a
// game opens sideways. After that, turning the phone wins: the screen
// follows the way it's held.
//
// Only an installed app on Android can turn the screen itself
// (screen.orientation.lock). On an iPhone, or in a browser tab, the screen
// simply follows the phone, as before, and every page works either way.

const SETTLE = 0.35;             // seconds the phone must stay turned before the screen follows

/** The rule on its own, so it can be tested without a phone. */
export class OrientationRule {
  constructor() {
    this.locked = null;          // the way the screen is turned
    this.baseline = null;        // the way the phone was held when we last chose
    this.held = null;
  }

  /** A page asks for its usual way round. Returns the lock to apply. */
  prefer(kind) {
    this.locked = kind;
    this.baseline = this.held;
    return kind;
  }

  /** The phone is held `kind` ('portrait', 'landscape', or null when lying
   *  flat). Returns a lock to apply now, or null. Only a change in how it's
   *  held counts: holding it upright while a game opens sideways does not
   *  undo the game's choice, but turning it afterwards does. */
  sense(kind) {
    if (!kind) return null;
    this.held = kind;
    if (this.baseline === null) { this.baseline = kind; return null; }
    if (kind === this.baseline) return null;
    this.baseline = kind;
    if (kind === this.locked) return null;
    this.locked = kind;
    return kind;
  }
}

/** Which way a phone is held, from gravity in the device's own axes. */
export function heldWay(ax, ay, naturalPortrait = true) {
  const x = Math.abs(ax);
  const y = Math.abs(ay);
  if (Math.max(x, y) < 5) return null;           // lying flat, or being shaken
  let way = null;
  if (y > x * 1.4) way = 'portrait';
  else if (x > y * 1.4) way = 'landscape';
  if (!way || naturalPortrait) return way;
  return way === 'portrait' ? 'landscape' : 'portrait';   // a tablet that's wide by nature
}

export function createOrientation() {
  const screenWay = globalThis.screen?.orientation;
  const rule = new OrientationRule();
  let canLock = typeof screenWay?.lock === 'function';
  let listening = false;
  let candidate = null;
  let since = 0;

  const naturalPortrait = () => {
    const upright = (screenWay?.angle ?? 0) % 180 === 0;
    return upright === String(screenWay?.type ?? 'portrait').startsWith('portrait');
  };

  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    const way = heldWay(a.x, a.y, naturalPortrait());
    const now = e.timeStamp / 1000;
    if (way !== candidate) { candidate = way; since = now; return; }
    if (now - since < SETTLE) return;
    apply(rule.sense(way));
  }

  function listen() {
    if (listening) return;
    listening = true;
    addEventListener('devicemotion', onMotion);
  }

  function apply(kind) {
    if (!kind || !canLock) return;
    // A browser tab or a computer says no; from then on the screen just follows the phone.
    screenWay.lock(kind).then(listen, () => { canLock = false; });
  }

  return {
    prefer(kind) { apply(rule.prefer(kind)); },
  };
}

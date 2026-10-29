// On a computer: WASD or the arrow keys walk, the mouse aims, a click or
// Space throws, G and H use the gadgets. On a phone: a floating joystick
// (Klayman aims the way it points), the K button, an auto-throw switch and
// the gadget buttons. read() returns the step's input once per game step
// (see NO_INPUT in game.js). The K button, Space and a click do the same:
// push a dirtball Klayman is touching, throw otherwise.
//
// The K button is a second stick, for aiming: it comes to where the thumb
// lands, like the joystick. Dragged, Klayman aims that way, all the way
// round; pressed without dragging, at the closest bacteria.

const MOVE_KEYS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};
const ACTION_KEY = 'Space';
const GADGET_KEYS = { KeyG: 0, KeyH: 1 };
const DEAD_ZONE = 0.22;
const K_DEAD_ZONE = 0.4;          // of the K button's travel: less is a plain press
const AUTO_KEY = 'klayman.autoThrow';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function createInput({
  stage, stickZone, stickBase, stickKnob, throwZone, kStick, throwButton, autoButton, gadgetButtons = [], onPause,
}) {
  const keys = new Set();
  let spaceDown = false;
  let mouseDown = false;
  let mouse = null;                // where the mouse is over the game, in CSS pixels
  let gadget = -1;                 // a gadget asked for since the last read
  let pressed = false;
  let auto = false;
  try { auto = localStorage.getItem(AUTO_KEY) === '1'; } catch { /* nothing saved */ }
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  // The K button: where the thumb landed, the way it's dragged (null: not
  // far enough to aim by hand), and whether it was pressed since the last read.
  const k = { id: null, ox: 0, oy: 0, steer: null, tapped: false };

  // ------------------------------------------------------------ keyboard
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause?.(); return; }
    // On a focused button or link, Enter and Space press it rather than throw.
    if (e.target instanceof Element && e.target.closest('button, a, summary, input')) return;
    if (MOVE_KEYS[e.code]) { keys.add(e.code); e.preventDefault(); }
    if (e.code in GADGET_KEYS && !e.repeat) { gadget = GADGET_KEYS[e.code]; e.preventDefault(); }
    if (e.code === ACTION_KEY) {
      if (!e.repeat) { pressed = true; spaceDown = true; }
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === ACTION_KEY) spaceDown = false;
  });
  addEventListener('blur', () => { keys.clear(); spaceDown = false; mouseDown = false; releaseStick(); releaseK(); });

  // --------------------------------------------------------------- mouse
  // Klayman aims at the mouse; a click throws (hold to keep throwing).
  function placeMouse(e) {
    const r = stage.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') placeMouse(e); });
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
    placeMouse(e);
    pressed = true;
    mouseDown = true;
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stage.addEventListener(type, (e) => { if (e.pointerType === 'mouse') mouseDown = false; });
  }
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // ------------------------------------------------------------- gadgets
  gadgetButtons.forEach((b, i) => {
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      gadget = i;
    });
    b.addEventListener('click', (e) => { if (e.detail === 0) gadget = i; });   // Enter on a focused button
  });

  // ------------------------------------------------------------ joystick
  function baseRadius() { return stickBase.offsetWidth / 2 || 56; }

  function placeBase(clientX, clientY) {
    const zone = stickZone.getBoundingClientRect();
    const r = baseRadius();
    const x = Math.min(Math.max(clientX - zone.left, r), zone.width - r);
    const y = Math.min(Math.max(clientY - zone.top, r), zone.height - r);
    stickBase.style.left = `${x}px`;
    stickBase.style.top = `${y}px`;
    stick.ox = zone.left + x;
    stick.oy = zone.top + y;
  }

  function moveKnob(clientX, clientY) {
    const r = baseRadius() * 0.62;
    let dx = clientX - stick.ox;
    let dy = clientY - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > r) { dx = (dx / d) * r; dy = (dy / d) * r; }
    stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const m = Math.min(1, d / r);
    if (m < DEAD_ZONE) { stick.x = 0; stick.y = 0; return; }
    stick.x = dx / (Math.hypot(dx, dy) || 1);
    stick.y = dy / (Math.hypot(dx, dy) || 1);
  }

  function releaseStick() {
    stick.id = null;
    stick.x = 0;
    stick.y = 0;
    stickKnob.style.transform = 'translate(-50%, -50%)';
    stickBase.classList.remove('is-active');
    stickBase.style.left = '';
    stickBase.style.top = '';
  }

  stickZone.addEventListener('pointerdown', (e) => {
    if (stick.id !== null) return;
    stick.id = e.pointerId;
    stickZone.setPointerCapture(e.pointerId);
    stickBase.classList.add('is-active');
    placeBase(e.clientX, e.clientY);
    moveKnob(e.clientX, e.clientY);
    e.preventDefault();
  });
  stickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) moveKnob(e.clientX, e.clientY);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stickZone.addEventListener(type, (e) => { if (e.pointerId === stick.id) releaseStick(); });
  }

  // ---------------------------------------------------------- the K button
  function kRadius() { return kStick.offsetWidth / 2 || 64; }
  function kTravel() { return kRadius() * 0.5; }

  /** The K button comes to the thumb; dragging is measured from where it landed. */
  function placeK(clientX, clientY) {
    const zone = throwZone.getBoundingClientRect();
    const r = kRadius();
    kStick.style.left = `${clamp(clientX - zone.left, r, zone.width - r)}px`;
    kStick.style.top = `${clamp(clientY - zone.top, r, zone.height - r)}px`;
    k.ox = clientX;
    k.oy = clientY;
  }

  function steerK(clientX, clientY) {
    const travel = kTravel();
    let dx = clientX - k.ox;
    let dy = clientY - k.oy;
    const d = Math.hypot(dx, dy);
    k.steer = d < travel * K_DEAD_ZONE ? null : { x: dx / d, y: dy / d };
    if (d > travel) { dx = (dx / d) * travel; dy = (dy / d) * travel; }
    throwButton.style.setProperty('--dx', `${dx}px`);
    throwButton.style.setProperty('--dy', `${dy}px`);
  }

  function releaseK() {
    k.id = null;
    k.steer = null;
    throwButton.classList.remove('is-down');
    throwButton.style.removeProperty('--dx');
    throwButton.style.removeProperty('--dy');
    kStick.style.left = '';
    kStick.style.top = '';
  }

  throwZone.addEventListener('pointerdown', (e) => {
    if (k.id !== null) return;
    k.id = e.pointerId;
    k.tapped = true;
    k.steer = null;
    throwZone.setPointerCapture(e.pointerId);
    throwButton.classList.add('is-down');
    placeK(e.clientX, e.clientY);
    pressed = true;
    e.preventDefault();
  });
  throwZone.addEventListener('pointermove', (e) => {
    if (e.pointerId === k.id) steerK(e.clientX, e.clientY);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    throwZone.addEventListener(type, (e) => { if (e.pointerId === k.id) releaseK(); });
  }

  // ------------------------------------------------------- auto throw
  // Set on the setup page, and switchable mid-game from the corner below
  // the throw button. It pushes too, when Klayman walks into a dirtball.
  function showAuto() {
    autoButton.setAttribute('aria-pressed', String(auto));
    autoButton.textContent = auto ? 'Auto throw: on' : 'Auto throw: off';
  }
  function setAuto(on) {
    auto = Boolean(on);
    try { localStorage.setItem(AUTO_KEY, auto ? '1' : '0'); } catch { /* private mode */ }
    showAuto();
  }
  // The switch sits inside the throw area; don't let a tap on it throw.
  autoButton.addEventListener('pointerdown', (e) => e.stopPropagation());
  autoButton.addEventListener('click', () => setAuto(!auto));
  showAuto();

  // No long-press menus or double-tap zoom on the controls.
  for (const el of [stickZone, throwZone]) {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return {
    get auto() { return auto; },
    setAuto,
    read() {
      let x = stick.x;
      let y = stick.y;
      for (const code of keys) {
        x += MOVE_KEYS[code][0];
        y += MOVE_KEYS[code][1];
      }
      const kDown = k.id !== null;
      const out = {
        x, y, pressed, held: spaceDown || mouseDown || kDown, auto, aim: mouse, gadget,
        steer: k.steer, seek: (k.tapped || kDown) && !k.steer,
      };
      pressed = false;
      gadget = -1;
      k.tapped = false;
      return out;
    },
    clear() {
      pressed = false;
      gadget = -1;
      keys.clear();
      spaceDown = false;
      mouseDown = false;
      releaseStick();
      releaseK();
      k.tapped = false;
    },
  };
}

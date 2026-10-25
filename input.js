// Keyboard on a computer; a floating joystick, a throw button and an
// auto-throw switch on a phone. read() returns { x, y, pressed, held, auto }
// once per game step.

const MOVE_KEYS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};
const ACTION_KEYS = new Set(['Space', 'KeyJ', 'KeyK', 'Enter']);
const DEAD_ZONE = 0.22;
const AUTO_KEY = 'klayman.autoThrow';

export function createInput({ stickZone, stickBase, stickKnob, throwZone, throwButton, autoButton, onPause }) {
  const keys = new Set();
  let actionKeys = 0;
  let pressed = false;
  let btnPointer = null;
  let auto = false;
  try { auto = localStorage.getItem(AUTO_KEY) === '1'; } catch { /* nothing saved */ }
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

  // ------------------------------------------------------------ keyboard
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { onPause?.(); return; }
    // On a focused button or link, Enter and Space press it rather than throw.
    if (e.target instanceof Element && e.target.closest('button, a, summary, input')) return;
    if (MOVE_KEYS[e.code]) { keys.add(e.code); e.preventDefault(); }
    if (ACTION_KEYS.has(e.code)) {
      if (!e.repeat) { pressed = true; actionKeys++; }
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (ACTION_KEYS.has(e.code)) actionKeys = Math.max(0, actionKeys - 1);
  });
  addEventListener('blur', () => { keys.clear(); actionKeys = 0; releaseStick(); releaseButton(); });

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

  // ------------------------------------------------------------ throw
  function releaseButton() {
    btnPointer = null;
    throwButton.classList.remove('is-down');
  }
  throwZone.addEventListener('pointerdown', (e) => {
    if (btnPointer !== null) return;
    btnPointer = e.pointerId;
    throwZone.setPointerCapture(e.pointerId);
    throwButton.classList.add('is-down');
    pressed = true;
    e.preventDefault();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    throwZone.addEventListener(type, (e) => { if (e.pointerId === btnPointer) releaseButton(); });
  }

  // ------------------------------------------------------- auto throw
  // Set on the setup page, and switchable mid-game under the throw button.
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
      const out = { x, y, pressed, held: actionKeys > 0 || btnPointer !== null, auto };
      pressed = false;
      return out;
    },
    clear() {
      pressed = false;
      keys.clear();
      actionKeys = 0;
      releaseStick();
      releaseButton();
    },
  };
}

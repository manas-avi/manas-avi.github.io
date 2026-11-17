// PCBend pre-launch page: "Play with it", the live 3D viewer with a short list of
// friendly controls. The viewer takes view changes by postMessage (see "Landing-page
// hooks" in /pcbend-demo/app.js).
//
// The viewer runs on this page's own thread (same origin), so every frame it draws is
// time the page cannot scroll. It is loaded only once the stage is actually on screen
// and the browser is idle, and it is told to stop drawing whenever the stage leaves
// the screen.
import { SHAPES, demoUrl, track } from '/pcbend/site.js';

const $ = id => document.getElementById(id);
const section = $('play');
const frame = $('pg-frame');
const loading = $('pg-loading');
const loadingText = $('pg-loading-text');
const hint = $('pg-hint');
const fullLink = $('pg-full');
const prompt = $('pg-prompt');

const state = {
  shape: SHAPES[0],
  t: 1,                 // 1 folded, 0 flat
  effect: 'rainbow',
  message: 'Hello from PCBend',
  brightness: 150,
  speed: 100,
  spin: true,
  diffuser: true,       // "Soft glow"
  chain: false,         // Advanced: show wiring
  hinges: false,        // Advanced: show hinges
  wireframe: false,     // Advanced: show mesh
};

// The whole view, as the viewer's URL or a fold-load message carries it.
const fullView = () => ({
  t: state.t, leds: true, lit: true, effect: state.effect, message: state.message,
  brightness: state.brightness, speed: state.speed, spin: state.spin, diffuser: state.diffuser,
  chain: state.chain, hinges: state.hinges, wireframe: state.wireframe,
  env: 'darkroom', frame: state.t ? 'folded' : 'flat', zoom: 1.2,
});

let started = false;      // the iframe has been given a src
let listening = false;    // the viewer has spoken once, so its message listener exists
let ready = false;        // a board is loaded and taking view messages
let pending = null;       // changes made while a board was loading

function send(msg) {
  if (ready) frame.contentWindow?.postMessage({ pcbend: msg }, location.origin);
  else pending = { ...pending, ...msg };
}

function showLoading(text, busy = true) {
  loadingText.textContent = text;
  loading.classList.toggle('failed', !busy);
  loading.classList.remove('done');
}

function start() {
  if (started) return;
  started = true;
  const q = new URLSearchParams({ embed: '1', fold: state.shape.folder });
  for (const [k, v] of Object.entries(fullView())) q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : v);
  frame.src = `/pcbend-demo/?${q}`;
}

const whenIdle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
let onScreen = false;
if ('IntersectionObserver' in window) {
  new IntersectionObserver(es => {
    const now = es.some(e => e.isIntersecting);
    if (now === onScreen) return;
    onScreen = now;
    if (onScreen && !started) whenIdle(() => { if (onScreen) start(); });
    if (started) send({ paused: !onScreen });
  }, { threshold: 0.15 }).observe(frame.parentElement);
} else {
  onScreen = true;
  start();
}

// While the page itself is being scrolled the viewer holds its frame, and picks up again
// a moment after the scrolling stops: nobody watches the model mid-scroll, and the scroll
// then has the GPU to itself (measured on an Intel UHD 620: ~35 fps scrolling past the
// live viewer, versus 60 with it holding still).
let scrollTimer = 0, scrollHeld = false;
addEventListener('scroll', () => {
  if (!started || !onScreen) return;
  if (!scrollHeld) { scrollHeld = true; send({ paused: true }); }
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    scrollHeld = false;
    if (onScreen) send({ paused: false });
  }, 180);
}, { passive: true });

window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
  if (e.data?.pcbendLoaded) {
    listening = true;
    ready = true;
    loading.classList.add('done');
    if (pending) { const p = pending; pending = null; send(p); }
    if (!onScreen) send({ paused: true });
  } else if (e.data?.pcbendError) {
    listening = true;
    ready = false;
    showLoading(`That shape didn't load. Pick another one.`, false);
  }
});

// ---- controls
const used = new Set();
function touched(control) {
  hint.classList.add('gone');
  if (!used.has(control)) { used.add(control); track('playground_interaction', { control }); }
}

// One pressed button per group.
function pressGroup(group, pressed) {
  group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === pressed)));
}

// Shape
const shapeGroup = $('pg-shapes');
for (const s of SHAPES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s.label;
  b.setAttribute('aria-pressed', String(s === state.shape));
  b.addEventListener('click', () => {
    if (s === state.shape) return;
    touched('shape');
    pressGroup(shapeGroup, b);
    state.shape = s;
    fullLink.href = demoUrl(s.folder);
    showLoading('Folding your shape…');
    if (listening) {
      ready = false;
      pending = null;   // the message below carries every setting
      frame.contentWindow?.postMessage({ pcbend: { fold: s.folder, ...fullView(), ms: 0 } }, location.origin);
    } else {
      started = false;
      start();
    }
  });
  shapeGroup.append(b);
}

// Pattern
const patternGroup = $('pg-patterns');
patternGroup.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  touched('pattern');
  pressGroup(patternGroup, b);
  state.effect = b.dataset.effect;
  send({ effect: state.effect });
}));

// Your message: typing switches the pattern to the scrolling message.
const msgInput = $('pg-message');
msgInput.value = state.message;
msgInput.addEventListener('input', () => {
  touched('message');
  state.message = msgInput.value;
  state.effect = 'text';
  pressGroup(patternGroup, patternGroup.querySelector('[data-effect="text"]'));
  send({ message: state.message, effect: 'text' });
  prompt.hidden = false;
});

// Brightness and speed
for (const [id, key] of [['pg-brightness', 'brightness'], ['pg-speed', 'speed']]) {
  const input = $(id);
  input.value = state[key];
  input.addEventListener('input', () => {
    touched(key);
    state[key] = Number(input.value);
    send({ [key]: state[key] });
  });
}

// Fold / Unfold
const foldBtn = $('pg-fold');
foldBtn.addEventListener('click', () => {
  touched('fold');
  state.t = state.t ? 0 : 1;
  foldBtn.textContent = state.t ? 'Unfold' : 'Fold';
  send({ t: state.t, ms: 2600, frame: state.t ? 'folded' : 'flat', zoom: 1.2 });
});

// Spin and Soft glow
for (const [id, key] of [['pg-spin', 'spin'], ['pg-glow', 'diffuser']]) {
  const b = $(id);
  b.setAttribute('aria-pressed', String(state[key]));
  b.addEventListener('click', () => {
    touched(key);
    state[key] = !state[key];
    b.setAttribute('aria-pressed', String(state[key]));
    send({ [key]: state[key] });
  });
}

// Advanced
for (const [id, key] of [['pg-show-wiring', 'chain'], ['pg-show-hinges', 'hinges'], ['pg-show-mesh', 'wireframe']]) {
  const box = $(id);
  box.checked = state[key];
  box.addEventListener('change', () => {
    touched(key);
    state[key] = box.checked;
    send({ [key]: state[key] });
  });
}

$('pg-reset').addEventListener('click', () => {
  touched('reset');
  send({ frame: state.t ? 'folded' : 'flat', zoom: 1.2, ms: 600 });
});

// The hint goes once someone has used the viewer itself: a click into the iframe
// takes focus from this window.
addEventListener('blur', () => { if (document.activeElement === frame) touched('drag'); });

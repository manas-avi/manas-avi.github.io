// PCBend pre-launch page: every looping clip of a real lamp. Clips play only while on
// screen, never by themselves for visitors who asked for less motion, and each has a
// pause button. The hero autoplays from the HTML itself, and the browser picks its
// portrait or wide cut from the <source media> list.
//
// Clips inside a [data-one-at-a-time] container take turns: one plays, the others hold a
// dimmed still frame, and the turn moves on every few seconds. Several clips decoding at
// once halves the scroll frame rate on laptop GPUs (measured on an Intel UHD 620: 46 fps
// with one tile clip playing, 30 with two or three). Pointing at a clip plays it.

const ROTATE_MS = 6000;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width: 700px)');
const hasMedia = v => Boolean(v.getAttribute('src') || v.querySelector('source'));
const state = new Map();   // video -> { visible, paused, btn, group }

function label(s) {
  if (!s.btn) return;
  s.btn.classList.toggle('paused', s.paused);
  s.btn.setAttribute('aria-label', s.paused ? 'Play video' : 'Pause video');
}

// The clip a group is showing: the one pointed at, else the one whose turn it is.
const liveOf = g => g.hover ?? g.active;

function sync(v) {
  const s = state.get(v);
  if (!s) return;
  const myTurn = !s.group || liveOf(s.group) === v;
  if (s.visible && !s.paused && myTurn && !v.closest('[hidden]') && hasMedia(v)) {
    v.muted = true;   // autoplay is only allowed muted
    v.play().catch(() => {});
  } else {
    v.pause();
  }
  if (s.group) {
    const live = liveOf(s.group);
    const liveRuns = live && !state.get(live).paused;
    v.parentElement.classList.toggle('is-idle', Boolean(liveRuns && live !== v));
  }
}

const loops = [...document.querySelectorAll('video.loop')];
const groups = [...document.querySelectorAll('[data-one-at-a-time]')].map(box => {
  const vids = [...box.querySelectorAll('video.loop')];
  return { box, vids, active: vids[0] ?? null, hover: null };
});
const groupOf = v => groups.find(g => g.vids.includes(v)) ?? null;
const syncGroup = g => g.vids.forEach(sync);

for (const v of loops) {
  const s = { visible: false, paused: reduced, btn: v.parentElement.querySelector('.vid-toggle'), group: groupOf(v) };
  state.set(v, s);
  label(s);
  s.btn?.addEventListener('click', () => {
    s.paused = !s.paused;
    label(s);
    // Pressing play on a resting clip is asking to watch that one: give it the turn.
    if (s.group && !s.paused) s.group.active = v;
    s.group ? syncGroup(s.group) : sync(v);
  });
}

for (const g of groups) {
  for (const v of g.vids) {
    const tile = v.closest('li') ?? v.parentElement;
    tile.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse' && !state.get(v).paused) { g.hover = v; syncGroup(g); }
    });
    tile.addEventListener('pointerleave', () => {
      if (g.hover === v) { g.hover = null; syncGroup(g); }
    });
  }
  if (reduced) continue;
  setInterval(() => {
    if (g.hover || document.hidden || !g.vids.some(v => state.get(v).visible)) return;
    // the next clip, in order, that has not been paused by hand
    const i = g.vids.indexOf(g.active);
    for (let k = 1; k <= g.vids.length; k++) {
      const next = g.vids[(i + k) % g.vids.length];
      if (!state.get(next).paused) { g.active = next; break; }
    }
    syncGroup(g);
  }, ROTATE_MS);
}

// The hero's phone cut also has its own still: swap the poster to match the screen.
for (const v of document.querySelectorAll('video[data-portrait-poster]')) {
  const wide = v.getAttribute('poster');
  const pick = () => { v.poster = narrow.matches ? v.dataset.portraitPoster : wide; };
  pick();
  narrow.addEventListener('change', pick);
}

// Start each clip the moment it can play, not only when it scrolls into view.
loops.forEach(v => v.addEventListener('canplay', () => sync(v)));

// Some browsers hold back autoplay until the visitor has interacted with the page. The
// first scroll, tap, click or key press anywhere then starts whatever should be playing.
const nudge = () => {
  loops.forEach(sync);
  for (const t of ['pointerdown', 'keydown', 'scroll', 'touchstart']) removeEventListener(t, nudge, true);
};
for (const t of ['pointerdown', 'keydown', 'scroll', 'touchstart']) addEventListener(t, nudge, { capture: true, passive: true });

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) { state.get(e.target).visible = e.isIntersecting; sync(e.target); }
  }, { threshold: 0.25 });
  loops.forEach(v => io.observe(v));
} else {
  loops.forEach(v => { state.get(v).visible = true; sync(v); });
}

// Hiding a clip with `hidden` is not reliably reported by the IntersectionObserver,
// so those changes re-check every clip.
new MutationObserver(() => loops.forEach(sync))
  .observe(document.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });

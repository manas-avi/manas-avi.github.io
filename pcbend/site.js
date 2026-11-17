// PCBend pre-launch page: shared data and small helpers for the page's modules.

export const DEMO = '/pcbend-demo/';

// Small-LED variant of each shape: it is the denser board, and the prettier one lit.
// LED counts are the number of `v` records in each folder's .led file.
export const SHAPES = [
  { id: 'cat',    label: 'Cat',         folder: 'cat-small',    faces: 102, leds: 933 },
  { id: 'star',   label: 'Star',        folder: 'star-small',   faces: 24,  leds: 272 },
  { id: 'batman', label: 'Bat',         folder: 'batman-small', faces: 92,  leds: 873 },
  { id: 'dome',   label: 'Dome',        folder: 'dome-small',   faces: 81,  leds: 827 },
  { id: 'bridge', label: 'Wave',        folder: 'bridge-small', faces: 90,  leds: 578 },
  { id: 'icosa',  label: 'Icosahedron', folder: 'icosa-small',  faces: 20,  leds: 155 },
  { id: 'cube',   label: 'Cube',        folder: 'cube-small',   faces: 12,  leds: 151 },
];

export const demoUrl = folder => `${DEMO}?fold=${encodeURIComponent(folder)}`;

document.documentElement.classList.remove('no-js');

// Analytics hook: events go to window.pcbendTrack if a provider is ever wired in. None
// is, so nothing is collected, as the privacy note says. Update that note if this changes.
export function track(name, props = {}) {
  try { window.pcbendTrack?.(name, props); } catch { /* analytics must never break the page */ }
}

// Any element with data-track="event_name" reports a click under that name.
export function initTracking() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-track]');
    if (el) track(el.dataset.track);
  });
}

// Underlines the header link of the section on screen: the one crossing a line 40%
// down the viewport. Recomputed on scroll, at most once a frame.
export function initNav() {
  const pairs = [...document.querySelectorAll('.top nav a[href^="#"]')]
    .map(a => [a, document.querySelector(a.getAttribute('href'))])
    .filter(([, el]) => el);
  if (!pairs.length) return;
  let queued = false;
  const update = () => {
    queued = false;
    const line = innerHeight * 0.4;
    for (const [a, el] of pairs) {
      const r = el.getBoundingClientRect();
      a.classList.toggle('on', r.top <= line && r.bottom > line);
    }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

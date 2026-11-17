// PCBend pre-launch page: the maker slideshow. The track is a native scroller with snap
// points, so swiping, trackpads and arrow keys work on their own. This adds the arrow
// buttons, the dots and a timed advance that loops. The timer pauses while someone is
// looking closely (pointer over it, keyboard focus in it, just swiped), while the
// slideshow is off screen, and never runs for visitors who asked for less motion.

const DELAY = 4500;   // ms each photo stays before moving on
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

for (const root of document.querySelectorAll('.slides')) {
  const track = root.querySelector('.slides-track');
  const slides = [...track.children];
  const dotsBox = root.querySelector('.slides-dots');
  if (slides.length < 2) { root.querySelector('.slides-nav')?.remove(); continue; }

  slides.forEach((s, i) => {
    s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
  });
  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Photo ${i + 1}`);
    b.addEventListener('click', () => { go(i); hold(); });
    dotsBox.append(b);
    return b;
  });

  const current = () => Math.round(track.scrollLeft / track.clientWidth);
  function go(i) {
    const n = (i + slides.length) % slides.length;
    track.scrollTo({ left: n * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  }
  function mark() {
    const i = current();
    dots.forEach((d, j) => d.setAttribute('aria-current', String(j === i)));
  }
  let queued = false;
  track.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; mark(); });
  }, { passive: true });
  mark();

  root.querySelectorAll('.slides-btn').forEach(b =>
    b.addEventListener('click', () => { go(current() + Number(b.dataset.step)); hold(); }));
  track.addEventListener('keydown', e => {
    const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!k) return;
    e.preventDefault();
    go(current() + k);
    hold();
  });

  // ---- the timed advance
  if (reduced) continue;
  let hovering = false, focused = false, visible = false, heldUntil = 0;
  // A person's own move (swipe, arrow, dot) holds the timer for a while.
  function hold() { heldUntil = performance.now() + DELAY * 2; }
  function tick() {
    if (visible && !hovering && !focused && !document.hidden && performance.now() >= heldUntil) go(current() + 1);
  }
  setInterval(tick, DELAY);
  root.addEventListener('pointerenter', () => { hovering = true; });
  root.addEventListener('pointerleave', () => { hovering = false; });
  root.addEventListener('focusin', () => { focused = true; });
  root.addEventListener('focusout', () => { focused = root.contains(document.activeElement); });
  track.addEventListener('touchstart', hold, { passive: true });
  track.addEventListener('wheel', hold, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); }, { threshold: 0.4 }).observe(root);
  } else {
    visible = true;
  }
}

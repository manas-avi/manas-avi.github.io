// PCBend pre-launch page: every looping clip of a real lamp. Clips play only while on
// screen, never by themselves for visitors who asked for less motion, and each has a
// pause button. The hero picks a portrait or a wide cut to suit the screen.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width: 700px)');
const state = new Map();   // video -> { visible, paused, btn }

function label(s) {
  if (!s.btn) return;
  s.btn.classList.toggle('paused', s.paused);
  s.btn.setAttribute('aria-label', s.paused ? 'Play video' : 'Pause video');
}

function sync(v) {
  const s = state.get(v);
  if (!s) return;
  if (s.visible && !s.paused && !v.closest('[hidden]') && v.getAttribute('src')) {
    v.muted = true;   // autoplay is only allowed muted
    v.play().catch(() => {});
  } else {
    v.pause();
  }
}

const loops = [...document.querySelectorAll('video.loop')];
for (const v of loops) {
  const s = { visible: false, paused: reduced, btn: v.parentElement.querySelector('.vid-toggle') };
  state.set(v, s);
  label(s);
  s.btn?.addEventListener('click', () => { s.paused = !s.paused; label(s); sync(v); });
}

// Clips with two cuts carry no src in the page, so a phone never starts downloading the
// wide one: the right cut is set here, and again if the screen changes shape.
for (const v of document.querySelectorAll('video[data-wide]')) {
  const pick = () => {
    const [src, poster] = narrow.matches
      ? [v.dataset.portrait, v.dataset.portraitPoster]
      : [v.dataset.wide, v.dataset.widePoster];
    if (v.getAttribute('src') === src) return;
    v.poster = poster;
    v.src = src;
    sync(v);
  };
  pick();
  narrow.addEventListener('change', pick);
}

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

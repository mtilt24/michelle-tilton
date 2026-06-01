// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }
});

// Testimonial scroller: arrows + auto-advance (pauses on hover/touch/focus, respects reduced motion)
document.addEventListener('DOMContentLoaded', () => {
  const scroller = document.querySelector('.testimonial-grid');
  if (!scroller) return;
  const step = () => {
    const card = scroller.querySelector('.t-card');
    if (!card) return scroller.clientWidth;
    const gap = parseFloat(getComputedStyle(scroller).columnGap) || 0;
    return card.offsetWidth + gap;
  };
  const advance = (dir) => {
    const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
    const atStart = scroller.scrollLeft <= 4;
    let left;
    if (dir > 0) left = atEnd ? 0 : scroller.scrollLeft + step();
    else left = atStart ? scroller.scrollWidth : scroller.scrollLeft - step();
    scroller.scrollTo({ left, behavior: 'smooth' });
  };
  let paused = false;
  const prev = document.getElementById('tPrev');
  const next = document.getElementById('tNext');
  if (prev) prev.addEventListener('click', () => { paused = true; advance(-1); });
  if (next) next.addEventListener('click', () => { paused = true; advance(1); });
  scroller.addEventListener('pointerenter', () => { paused = true; });
  scroller.addEventListener('pointerleave', () => { paused = false; });
  scroller.addEventListener('focusin', () => { paused = true; });
  scroller.addEventListener('touchstart', () => { paused = true; }, { passive: true });
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => { if (!paused) advance(1); }, 4500);
  }
});

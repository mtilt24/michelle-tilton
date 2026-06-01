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

// Testimonial auto-scroller (pauses on hover / touch / focus, respects reduced motion)
document.addEventListener('DOMContentLoaded', () => {
  const scroller = document.querySelector('.testimonial-grid');
  if (!scroller || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let paused = false;
  const pause = () => { paused = true; };
  const resume = () => { paused = false; };
  scroller.addEventListener('pointerenter', pause);
  scroller.addEventListener('pointerleave', resume);
  scroller.addEventListener('focusin', pause);
  scroller.addEventListener('touchstart', pause, { passive: true });
  setInterval(() => {
    if (paused) return;
    const card = scroller.querySelector('.t-card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(scroller).columnGap) || 0;
    const step = card.offsetWidth + gap;
    const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
    scroller.scrollTo({ left: atEnd ? 0 : scroller.scrollLeft + step, behavior: 'smooth' });
  }, 4500);
});

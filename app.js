// ===== CUSTOM CURSOR WITH SPOTLIGHT GLOW =====
const cursorGlow = document.getElementById('cursorGlow');
const cursorDot = document.getElementById('cursorDot');
let mouseX = 0, mouseY = 0;
let glowX = 0, glowY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursorDot.style.left = mouseX + 'px';
  cursorDot.style.top = mouseY + 'px';
});

// Smooth follow for the glow
function animateCursor() {
  glowX += (mouseX - glowX) * 0.08;
  glowY += (mouseY - glowY) * 0.08;
  cursorGlow.style.left = glowX + 'px';
  cursorGlow.style.top = glowY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// Hover effects on interactive elements
document.querySelectorAll('a, button, .folder, .skill-panel, .cert-card').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursorDot.classList.add('hovering');
    cursorGlow.style.width = '400px';
    cursorGlow.style.height = '400px';
  });
  el.addEventListener('mouseleave', () => {
    cursorDot.classList.remove('hovering');
    cursorGlow.style.width = '300px';
    cursorGlow.style.height = '300px';
  });
});


// ===== SCATTER TEXT ANIMATION =====
// Split each .scatter-text into individual character spans
document.querySelectorAll('.scatter-text').forEach(el => {
  const text = el.textContent;
  el.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.classList.add('char');
    span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
    el.appendChild(span);
  }
});

// Use GSAP ScrollTrigger to scatter and reform
gsap.registerPlugin(ScrollTrigger);

document.querySelectorAll('.scatter-text').forEach(el => {
  const chars = el.querySelectorAll('.char');

  // Set initial scattered state
  gsap.set(chars, {
    opacity: 0,
    x: () => gsap.utils.random(-120, 120),
    y: () => gsap.utils.random(-80, 80),
    rotation: () => gsap.utils.random(-30, 30),
    scale: () => gsap.utils.random(0.5, 1.5),
  });

  // Animate to reformed state on scroll
  gsap.to(chars, {
    opacity: 1,
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    duration: 0.8,
    ease: 'back.out(1.7)',
    stagger: 0.02,
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
      end: 'top 40%',
      toggleActions: 'play none none reverse',
    }
  });
});


// ===== REVEAL-UP ANIMATIONS =====
document.querySelectorAll('.reveal-up').forEach((el, i) => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top 88%',
    onEnter: () => el.classList.add('revealed'),
    onLeaveBack: () => el.classList.remove('revealed'),
  });
});


// ===== HORIZONTAL SCROLL SECTION =====
const horizontalTrack = document.getElementById('horizontalTrack');
const wrapper = document.querySelector('.horizontal-scroll-wrapper');

if (horizontalTrack && wrapper) {
  const totalScroll = horizontalTrack.scrollWidth - window.innerWidth;

  gsap.to(horizontalTrack, {
    x: -totalScroll,
    ease: 'none',
    scrollTrigger: {
      trigger: wrapper,
      start: 'top 35%',
      end: () => `+=${totalScroll}`,
      scrub: 1,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    }
  });
}


// ===== NAV SCROLL EFFECT =====
let lastScroll = 0;
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  if (currentScroll > 100) {
    nav.style.background = 'rgba(10, 10, 15, 0.95)';
  } else {
    nav.style.background = 'rgba(10, 10, 15, 0.7)';
  }
  lastScroll = currentScroll;
});


// ===== FOLDER HOVER TILT =====
document.querySelectorAll('.folder').forEach(folder => {
  folder.addEventListener('mousemove', (e) => {
    const rect = folder.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    folder.style.transform = `translateY(-6px) perspective(800px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
  });

  folder.addEventListener('mouseleave', () => {
    folder.style.transform = 'translateY(0) perspective(800px) rotateX(0) rotateY(0)';
  });
});


// ===== WORK PAGE FILTER =====
const filterBtns = document.querySelectorAll('.filter-btn');
const filteredGrid = document.getElementById('filteredGrid');

if (filterBtns.length && filteredGrid) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      const cards = filteredGrid.querySelectorAll('.project-card, .folder');

      cards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = '';
          card.classList.add('revealed');
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}


// ===== VIDEO HOVER PLAY =====
document.querySelectorAll('.folder-video video, .project-card-video').forEach(video => {
  const card = video.closest('.folder') || video.closest('.project-card');
  if (card) {
    card.addEventListener('mouseenter', () => video.play());
    card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
  }
});


// ===== SMOOTH SCROLL FOR NAV LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

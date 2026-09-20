import { icon } from './icons.js';
import { getPreferences, setPreference } from './feedback.js';

export function setupMotion() {
  const root = document.documentElement;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = !getPreferences().motion;
  function applyPreference() {
    root.classList.toggle('reduced-motion', reduced);
  }
  applyPreference();
  window.addEventListener('league:preferences', () => {
    if (reduced === !getPreferences().motion) return;
    reduced = !getPreferences().motion;
    applyPreference();
    scrollMode();
    requestTick();
  });
  preference.addEventListener('change', (event) =>
    setPreference('motion', !event.matches),
  );
  root.classList.add('motion-ready');
  const reveal = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          reveal.unobserve(entry.target);
        }
      }),
    { threshold: 0.05 },
  );
  document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));

  const section = document.querySelector('#cinematic');
  const phone = matchMedia(
    '(max-width: 900px), (max-height: 520px) and (max-width: 1100px)',
  );
  const video = document.querySelector('#arena-video');
  const play = document.querySelector('#cinema-play');
  const mute = document.querySelector('#cinema-mute');
  const modeButton = document.querySelector('#cinema-mode');
  const hint = document.querySelector('#cinema-hint');
  const finish = document.querySelector('#cinema-finish');
  const bar = document.querySelector('#cinema-progress');
  const caption = document.querySelector('.cinema-caption');
  let natural = false,
    frame = 0,
    target = 0,
    near = false,
    scrollPosition = window.scrollY;
  let userMuted = false;
  function ensureSource() {
    if (!video.getAttribute('src')) {
      video.src = '/arena.mp4';
      video.preload = 'auto';
      video.load();
    }
  }
  function updateButtons() {
    play.innerHTML =
      icon(natural && !video.paused ? 'pause' : 'play') +
      (natural && !video.paused ? 'Pause video' : 'Play with sound');
    mute.innerHTML = icon(video.muted ? 'volume-off' : 'volume-on');
    mute.setAttribute(
      'aria-label',
      video.muted ? 'Turn sound on' : 'Mute video',
    );
    mute.title = video.muted ? 'Turn sound on' : 'Mute video';
    modeButton.innerHTML =
      icon('scroll') +
      (phone.matches && !section.classList.contains('is-immersive')
        ? 'Scroll through'
        : 'Scroll mode');
    hint.textContent = natural
      ? 'Original audio. Scroll to return to silent scroll mode.'
      : reduced
        ? 'Tap play to watch with sound. Motion is reduced.'
        : phone.matches && !section.classList.contains('is-immersive')
          ? 'Your arena video. Tap play for original sound.'
          : 'Scroll to move through the video. Tap play for original sound.';
  }
  function overlay(progress) {
    const amount = Math.min(1, Math.max(0, (progress - 0.83) / 0.16));
    finish.style.opacity = amount;
    finish.style.transform = `translateY(${(1 - amount) * 30}px)`;
    finish.classList.toggle('visible', amount > 0.8);
    finish.inert = amount <= 0.8;
    const immersive =
      phone.matches && section.classList.contains('is-immersive');
    caption.style.opacity = immersive ? 1 : Math.max(0, 1 - progress * 2.6);
    caption.querySelector('span').style.opacity = immersive
      ? Math.max(0, 1 - progress * 6)
      : 1;
    caption.querySelector('strong').style.opacity = immersive
      ? Math.min(1, Math.max(0, (progress - 0.12) / 0.14)) *
        Math.min(1, Math.max(0, (0.65 - progress) / 0.16))
      : 1;
    bar.style.transform = 'scaleX(' + progress + ')';
  }
  function seek() {
    if (
      !natural &&
      !reduced &&
      near &&
      Number.isFinite(video.duration) &&
      !video.seeking &&
      Math.abs(video.currentTime - target) > 0.055
    ) {
      video.currentTime = Math.min(Math.max(0, video.duration - 0.05), target);
    }
  }
  function tick() {
    frame = 0;
    const cinemaRect = section.getBoundingClientRect();
    const cinemaActive =
      phone.matches &&
      section.classList.contains('is-immersive') &&
      cinemaRect.top <= 2 &&
      cinemaRect.bottom > innerHeight * 0.5;
    document.body.classList.toggle('cinema-active', cinemaActive);
    for (const chrome of document.querySelectorAll('.site-header,.phone-tabs'))
      chrome.inert = cinemaActive;
    if (natural || reduced) return;
    if (phone.matches && !section.classList.contains('is-immersive')) {
      overlay(0);
      return;
    }
    const header =
      phone.matches && section.classList.contains('is-immersive')
        ? 0
        : document.querySelector('.site-header').offsetHeight;
    const rect = section.getBoundingClientRect();
    const travel = Math.max(1, section.offsetHeight - (innerHeight - header));
    const progress = Math.min(1, Math.max(0, (header - rect.top) / travel));
    overlay(progress);
    if (near && Number.isFinite(video.duration)) {
      target = progress * video.duration;
      seek();
    }
  }
  function requestTick() {
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function scrollMode() {
    natural = false;
    video.pause();
    video.muted = true;
    updateButtons();
    requestTick();
  }
  async function startPlayback() {
    ensureSource();
    natural = true;
    overlay(0);
    if (
      video.currentTime >= video.duration - 0.1 ||
      !video.currentTime ||
      video.paused
    )
      video.currentTime = 0;
    video.muted = userMuted;
    video.volume = 0.65;
    try {
      await video.play();
      updateButtons();
    } catch {
      natural = false;
      video.muted = true;
      updateButtons();
      hint.textContent = 'Playback could not start. Tap play to try again.';
    }
  }
  play.addEventListener('click', () => {
    if (natural && !video.paused) {
      video.pause();
      updateButtons();
    } else {
      userMuted = false;
      void startPlayback();
    }
  });
  mute.addEventListener('click', () => {
    if (!natural) {
      userMuted = false;
      void startPlayback();
    } else {
      userMuted = !video.muted;
      video.muted = userMuted;
      updateButtons();
    }
  });
  modeButton.addEventListener('click', () => {
    if (phone.matches) section.classList.toggle('is-immersive');
    scrollMode();
    if (section.classList.contains('is-immersive'))
      window.scrollTo({
        top: section.offsetTop,
        behavior: reduced ? 'instant' : 'smooth',
      });
  });
  function exitCinema() {
    section.classList.remove('is-immersive');
    document.body.classList.remove('cinema-active');
    document
      .querySelectorAll('.site-header,.phone-tabs')
      .forEach((el) => (el.inert = false));
    scrollMode();
    section.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  document.querySelector('#cinema-exit').addEventListener('click', exitCinema);
  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      document.body.classList.contains('cinema-active')
    )
      exitCinema();
  });
  document.querySelectorAll('a[href="#cinematic"]').forEach((link) =>
    link.addEventListener('click', () => {
      if (phone.matches) section.classList.add('is-immersive');
      requestTick();
    }),
  );
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#cinematic') {
      section.classList.remove('is-immersive');
      document.body.classList.remove('cinema-active');
      document
        .querySelectorAll('.site-header,.phone-tabs')
        .forEach((el) => (el.inert = false));
      scrollMode();
    }
  });
  phone.addEventListener('change', () => {
    updateButtons();
    requestTick();
  });
  video.addEventListener('loadedmetadata', requestTick);
  video.addEventListener('seeked', seek);
  video.addEventListener('timeupdate', () => {
    if (natural && video.duration) overlay(video.currentTime / video.duration);
  });
  video.addEventListener('ended', () => {
    overlay(1);
    updateButtons();
  });
  video.addEventListener('error', () => {
    hint.textContent =
      'The arena video could not load. You can still view all league results.';
  });
  const lazy = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        near = entry.isIntersecting;
        if (near) {
          ensureSource();
          requestTick();
        } else if (natural) {
          video.pause();
          updateButtons();
        }
      }),
    { rootMargin: '250px' },
  );
  lazy.observe(section);
  const visibility = new IntersectionObserver((entries) =>
    entries.forEach((entry) => {
      if (!entry.isIntersecting && natural) {
        video.pause();
        updateButtons();
      }
    }),
  );
  visibility.observe(video);
  window.addEventListener(
    'scroll',
    () => {
      if (natural && Math.abs(window.scrollY - scrollPosition) > 4)
        scrollMode();
      scrollPosition = window.scrollY;
      requestTick();
    },
    { passive: true },
  );
  window.addEventListener('resize', requestTick, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      video.pause();
      updateButtons();
    }
  });
  updateButtons();
  requestTick();

  const nav = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting)
          document
            .querySelectorAll('.desktop-nav a')
            .forEach((a) =>
              a.classList.toggle('active', a.hash === '#' + entry.target.id),
            );
      }),
    { rootMargin: '-20% 0px -55% 0px' },
  );
  document
    .querySelectorAll('#home, #league, #matches, #clips')
    .forEach((el) => nav.observe(el));
}

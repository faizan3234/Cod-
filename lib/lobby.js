import { getPreferences } from './feedback.js';

// Layered CSS perspective works without WebGL, sensors or a render loop at rest.
export function setupLobby() {
  const hero = document.querySelector('.lobby-hero');
  const scene = hero.querySelector('.lobby-scene');
  const embers = hero.querySelector('.lobby-embers');
  for (let i = 0; i < 14; i++) {
    const mote = document.createElement('i');
    mote.style.setProperty('--x', `${(i * 31 + 7) % 100}%`);
    mote.style.setProperty('--delay', `${-(i * 0.87)}s`);
    mote.style.setProperty('--duration', `${7 + (i % 5)}s`);
    embers.append(mote);
  }
  let near = true,
    frame = 0,
    pointerX = 0,
    pointerY = 0;
  function update() {
    frame = 0;
    const enabled = getPreferences().motion && !document.hidden && near;
    hero.classList.toggle('lobby-paused', !enabled);
    const progress = enabled
      ? Math.min(
          1,
          Math.max(0, -hero.getBoundingClientRect().top / hero.offsetHeight),
        )
      : 0;
    scene.style.setProperty('--scene-y', `${progress * 70}px`);
    scene.style.setProperty('--scene-scale', 1 + progress * 0.045);
    scene.style.setProperty(
      '--tilt-x',
      `${enabled ? -pointerY * 2.5 : 0}deg`,
    );
    scene.style.setProperty('--tilt-y', `${enabled ? pointerX * 3.5 : 0}deg`);
  }
  function request() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  new IntersectionObserver(([entry]) => {
    near = entry.isIntersecting;
    request();
  }).observe(hero);
  hero.addEventListener(
    'pointermove',
    (event) => {
      if (!getPreferences().motion) return;
      const box = hero.getBoundingClientRect();
      pointerX = ((event.clientX - box.left) / box.width) * 2 - 1;
      pointerY = ((event.clientY - box.top) / box.height) * 2 - 1;
      request();
    },
    { passive: true },
  );
  hero.addEventListener('pointerleave', () => {
    pointerX = pointerY = 0;
    request();
  });
  window.addEventListener(
    'scroll',
    () => {
      if (near) request();
    },
    { passive: true },
  );
  window.addEventListener('league:preferences', request);
  document.addEventListener('visibilitychange', request);
  request();
}

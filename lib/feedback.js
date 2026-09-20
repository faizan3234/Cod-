import { showSheet, hideSheet } from './sheets.js';
const defaults = {
  sound: false,
  haptics: true,
  motion: !matchMedia('(prefers-reduced-motion: reduce)').matches,
};
let preferences = { ...defaults },
  context,
  lastTap = 0;
try {
  const saved = JSON.parse(localStorage.getItem('solo-feedback') || '{}');
  for (const key of Object.keys(defaults))
    if (typeof saved[key] === 'boolean') preferences[key] = saved[key];
  if (
    saved.motion === undefined &&
    localStorage.getItem('solo-motion') === 'reduced'
  )
    preferences.motion = false;
} catch {
  /* Device preferences are optional. */
}

export const getPreferences = () => ({ ...preferences });
export function setPreference(key, value) {
  if (!(key in defaults)) return;
  preferences[key] = !!value;
  try {
    localStorage.setItem('solo-feedback', JSON.stringify(preferences));
  } catch {
    /* In-memory controls still work. */
  }
  window.dispatchEvent(
    new CustomEvent('league:preferences', { detail: getPreferences() }),
  );
}
function unlockAudio() {
  if (!preferences.sound || document.hidden) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    context ||= new Audio();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch {
    /* Unsupported audio never blocks a result. */
  }
}

export function feedback(kind) {
  if (document.hidden) return;
  const patterns = {
    saved: [12, 35, 18],
    'charter-locked': [10, 30, 16],
    error: 10,
    selection: 6,
    copied: 8,
  };
  if (!(kind in patterns)) return;
  if (preferences.haptics && navigator.vibrate) {
    const now = performance.now();
    if (now - lastTap > 80) {
      try {
        navigator.vibrate(patterns[kind]);
      } catch {
        /* Unsupported feedback is optional. */
      }
      lastTap = now;
    }
  }
  // Exactly three event sounds. Ordinary navigation never produces audio.
  const notes = {
    saved: [659, 880],
    'charter-locked': [440, 554, 659],
    error: [220, 165],
  }[kind];
  if (!notes || !preferences.sound || context?.state !== 'running') return;
  const start = context.currentTime;
  notes.forEach((frequency, i) => {
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      at = start + i * 0.09;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.035, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.16);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });
}

export function setupFeedback() {
  const dialog = document.querySelector('#settings-sheet');
  const controls = Object.fromEntries(
    Object.keys(defaults).map((key) => [
      key,
      document.querySelector('#setting-' + key),
    ]),
  );
  const audioSupported = !!(window.AudioContext || window.webkitAudioContext);
  function sync() {
    for (const [key, input] of Object.entries(controls))
      input.checked = preferences[key];
    controls.haptics.disabled = !navigator.vibrate;
    controls.sound.disabled = !audioSupported;
    if (!navigator.vibrate) controls.haptics.checked = false;
    document.querySelector('#haptic-support').textContent = navigator.vibrate
      ? 'Short feedback on supported devices.'
      : 'This browser does not support haptics.';
  }
  document.querySelector('#settings-open').addEventListener('click', () => {
    sync();
    showSheet(dialog);
  });
  document
    .querySelector('#settings-close')
    .addEventListener('click', () => void hideSheet(dialog));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    void hideSheet(dialog);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      void hideSheet(dialog);
  });
  for (const [key, input] of Object.entries(controls))
    input.addEventListener('change', () => {
      setPreference(key, input.checked);
      if (key === 'sound') unlockAudio();
      feedback('selection');
    });
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('keydown', unlockAudio);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && context?.state === 'running') void context.suspend();
  });
  window.addEventListener('league:preferences', sync);
  sync();
}

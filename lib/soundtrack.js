import { getPreferences, feedback } from './feedback.js';
import { icon } from './icons.js';

let database,
  queue = Promise.resolve();
function storedTrack(kind, file) {
  const operation = queue.then(async () => {
    database ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('solo-league-audio', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('tracks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const db = await database;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        'tracks',
        kind === 'read' ? 'readonly' : 'readwrite',
      );
      const store = tx.objectStore('tracks');
      const request =
        kind === 'read'
          ? store.get('current')
          : kind === 'remove'
            ? store.delete('current')
            : store.put(file, 'current');
      tx.oncomplete = () => resolve(kind === 'read' ? request.result : true);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  });
  queue = operation.catch(() => {});
  return operation;
}

export function setupSoundtrack() {
  const audio = document.querySelector('#lobby-audio');
  const picker = document.querySelector('#soundtrack-file');
  const play = document.querySelector('#soundtrack-play');
  const remove = document.querySelector('#soundtrack-remove');
  const volume = document.querySelector('#soundtrack-volume');
  const beats = document.querySelector('#soundtrack-haptics');
  const status = document.querySelector('#soundtrack-status');
  const hero = document.querySelector('.lobby-hero');
  const label = document.querySelector('#lobby-sound-label');
  const open = document.querySelector('#lobby-sound');
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let track,
    url,
    context,
    analyser,
    source,
    samples,
    frame = 0,
    revision = 0;
  let lastBeat = 0,
    average = 0,
    previous = 0,
    lastFrame = 0;
  audio.volume = 0.35;
  beats.checked = false;
  beats.disabled = !navigator.vibrate || !AudioContext;
  if (beats.disabled)
    document.querySelector('#beat-support').textContent =
      'Beat vibration is unavailable in this browser. Music still works.';

  function sync() {
    const playing = !audio.paused && !!track;
    document.body.classList.toggle('music-playing', playing);
    play.innerHTML =
      (playing ? 'Pause music ' : 'Play music ') +
      icon(playing ? 'pause' : 'play');
    play.setAttribute('aria-pressed', String(playing));
    label.textContent = playing
      ? 'Music on · pause'
      : track
        ? 'Play your soundtrack'
        : 'Your soundtrack';
    open.setAttribute(
      'aria-label',
      playing
        ? 'Pause soundtrack'
        : track
          ? 'Play soundtrack'
          : 'Choose your soundtrack',
    );
    document.querySelector('.soundtrack-controls').hidden = !track;
    document.querySelector('.soundtrack-volume').hidden = !track;
    document.querySelector('#soundtrack-name').textContent =
      track?.name || 'Bring your own audio.';
  }
  function stopAnalysis() {
    cancelAnimationFrame(frame);
    frame = 0;
    hero?.style?.setProperty('--music-energy', 0);
  }
  function analyse(now) {
    frame = 0;
    if (audio.paused || document.hidden || !analyser) return;
    const prefs = getPreferences();
    // Audio energy drives light intensity; pulses are opt-in, brief and rate-limited.
    if (now - lastFrame > 45) {
      lastFrame = now;
      analyser.getByteFrequencyData(samples);
      const energy =
        samples.slice(2, 13).reduce((sum, n) => sum + n, 0) / (11 * 255);
      average = average * 0.93 + energy * 0.07;
      if (prefs.motion)
        hero?.style?.setProperty('--music-energy', Math.min(1, energy));
      if (
        beats.checked &&
        prefs.haptics &&
        prefs.motion &&
        energy > 0.18 &&
        energy > average * 1.25 &&
        energy - previous > 0.025 &&
        now - lastBeat > 700
      ) {
        try {
          navigator.vibrate?.(7);
        } catch {
          /* Optional device support. */
        }
        lastBeat = now;
      }
      previous = energy;
    }
    frame = requestAnimationFrame(analyse);
  }
  async function start() {
    if (!track) {
      document.querySelector('#settings-open').click();
      return;
    }
    document.querySelectorAll('video').forEach((v) => v.pause());
    try {
      if (AudioContext && !context) {
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);
        samples = new Uint8Array(analyser.frequencyBinCount);
      }
      const resume = context?.resume();
      const playback = audio.play();
      await Promise.all([resume, playback]);
      status.textContent =
        'Playing on this device. Video playback pauses music.';
    } catch {
      audio.pause();
      status.textContent =
        'Could not play this audio. Try an MP3 or tap Play again.';
    }
    sync();
  }
  function assign(file) {
    revision++;
    audio.pause();
    if (url) URL.revokeObjectURL(url);
    track = file;
    if (file) {
      url = URL.createObjectURL(file);
      audio.src = url;
    } else {
      url = null;
      audio.removeAttribute('src');
    }
    audio.load();
    sync();
  }
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (!file) return;
    if (
      file.size <= 0 ||
      file.size > 20_000_000 ||
      !/^audio\/(mpeg|mp3|mp4|x-m4a|wav|x-wav|wave|ogg|webm|flac)$/.test(
        file.type,
      )
    ) {
      status.textContent = 'Choose a supported audio file under 20 MB.';
      picker.value = '';
      return;
    }
    assign(file);
    const current = revision;
    status.textContent = 'Ready. Tap Play to start your soundtrack.';
    try {
      await storedTrack('write', file);
      if (current === revision)
        status.textContent = 'Saved on this device. Tap Play to start.';
    } catch {
      if (current === revision)
        status.textContent =
          'Ready for this visit. This browser could not save the track for later.';
    }
    picker.value = '';
  });
  remove.addEventListener('click', async () => {
    assign(null);
    beats.checked = false;
    try {
      await storedTrack('remove');
      status.textContent = 'Track removed from this device.';
    } catch {
      status.textContent =
        'Track stopped. Browser storage could not be cleared; it may return on refresh.';
    }
  });
  for (const button of [play, open])
    button.addEventListener('click', () => {
      if (!audio.paused) audio.pause();
      else void start();
    });
  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value) / 100;
  });
  beats.addEventListener('change', () => {
    if (beats.checked) feedback('selection');
  });
  audio.addEventListener('play', () => {
    sync();
    if (!frame && analyser) frame = requestAnimationFrame(analyse);
  });
  audio.addEventListener('pause', () => {
    stopAnalysis();
    sync();
  });
  audio.addEventListener('error', () => {
    if (track)
      status.textContent =
        'This browser could not decode the track. Choose an MP3 file.';
    stopAnalysis();
    sync();
  });
  let preDuckVolume = audio.volume;
  document.addEventListener(
    'play',
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        if (!event.target.muted) {
          preDuckVolume = audio.volume;
          audio.volume = 0.2;
        }
      }
    },
    true,
  );
  document.addEventListener(
    'pause',
    (event) => {
      if (event.target instanceof HTMLVideoElement && !event.target.muted) {
        audio.volume = preDuckVolume;
      }
    },
    true,
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.pause();
      void context?.suspend();
    }
  });
  window.addEventListener('league:preferences', () => {
    if (!getPreferences().motion) hero?.style?.setProperty('--music-energy', 0);
  });
  window.addEventListener('pagehide', () => {
    audio.pause();
    stopAnalysis();
  });
  const initialRevision = revision;
  void storedTrack('read')
    .then((file) => {
      if (file instanceof Blob && initialRevision === revision) {
        assign(file);
        status.textContent = 'Your saved track is ready. Tap Play to start.';
      }
    })
    .catch(() => {});
  sync();
}

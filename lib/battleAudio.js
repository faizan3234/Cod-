// COD Battlefield Audio & Haptics Engine
// Automatic 7-minute Dhurandhar delay + gesture unlock + manual override + synchronized beat-driven haptics

const BPM = 130;
const BEAT_DURATION = 60 / BPM; // ~0.461538 seconds per beat
const BARS = 8;
const LOOP_DURATION = BARS * 4 * BEAT_DURATION; // ~14.769 seconds
const DHURANDHAR_DELAY_MS = 7 * 60 * 1000; // 7 minutes from start

const sessionStartTime = Date.now();
let isPlaying = false;
let userMuted = false;
let hapticsEnabled = true;
let audioUnlocked = false;
let dhurandharActive = false;
let dhurandharTriggerTimer = 0;
let lastTriggeredBeat = -1;
let animFrameId = 0;
let watchdogId = 0;

// Web Audio synthesizer fallback state
let audioCtx = null;
let isSynthActive = false;
let nextSynthStepTime = 0;
let synthStep = 0;
let synthTimer = 0;

export function setupBattleAudio() {
  const audioElement = document.querySelector('#battle-music');
  const gateway = document.querySelector('#deploy-gateway');
  const deployBtn = document.querySelector('#btn-deploy');
  const soundToggle = document.querySelector('#battle-sound-toggle');
  const hapticToggle = document.querySelector('#battle-haptic-toggle');

  if (audioElement) {
    audioElement.loop = true;
    audioElement.volume = 0.72;

    // Loop watchdog: when track finishes, ensure seamless loop
    audioElement.addEventListener('ended', () => {
      if (dhurandharActive && isPlaying && !userMuted) {
        audioElement.currentTime = 0;
        void audioElement.play().catch(() => {});
      }
    });

    audioElement.addEventListener('pause', () => {
      // If paused unexpectedly while active, auto-recover if not user-muted
      if (dhurandharActive && isPlaying && !userMuted) {
        setTimeout(() => {
          if (dhurandharActive && isPlaying && !userMuted && audioElement.paused) {
            void audioElement.play().catch(() => {});
          }
        }, 300);
      }
    });
  }

  // Update Media Session API to give Android/iOS background playback priority & lockscreen controls
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Dhurandhar (COD Battle Anthem)',
        artist: 'Call of Duty: Mobile Solo League',
        album: 'Dhurandhar Combat OST',
        artwork: [
          { src: '/media/cod-mobile-hero.jpg', sizes: '512x512', type: 'image/jpeg' },
          { src: '/media/cod-mobile-hero.jpg', sizes: '192x192', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        void startAudio(true);
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        pauseAudio();
      });
    } catch {}
  }

  function initAudioContext() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = new AudioContextClass();
  }

  // Procedural Web Audio fallback (if native audio element cannot load)
  function startProceduralTacticalLoop() {
    initAudioContext();
    if (!audioCtx || isSynthActive) return;
    isSynthActive = true;

    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }

    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    function triggerProceduralKick(time) {
      if (!isSynthActive || !audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, time);
      osc.frequency.exponentialRampToValueAtTime(38, time + 0.22);

      gain.gain.setValueAtTime(0.85, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(time);
      osc.stop(time + 0.4);
    }

    function triggerProceduralSnare(time) {
      if (!isSynthActive || !audioCtx) return;
      const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      noise.start(time);
    }

    nextSynthStepTime = audioCtx.currentTime + 0.05;
    const stepInterval = BEAT_DURATION / 2; // 8th note resolution
    synthStep = 0;

    function synthScheduler() {
      if (!isSynthActive || !audioCtx) return;
      while (nextSynthStepTime < audioCtx.currentTime + 0.25) {
        if (synthStep % 2 === 0) {
          const beatInBar = (synthStep / 2) % 4;
          if (beatInBar === 0 || beatInBar === 2) {
            triggerProceduralKick(nextSynthStepTime);
          } else {
            triggerProceduralSnare(nextSynthStepTime);
          }
        }
        synthStep++;
        nextSynthStepTime += stepInterval;
      }
      synthTimer = setTimeout(synthScheduler, 45);
    }

    synthScheduler();
  }

  function stopProceduralLoop() {
    isSynthActive = false;
    clearTimeout(synthTimer);
  }

  // Continuous visual beat pulse & haptic coordination loop
  function beatLoop() {
    if (!isPlaying) {
      document.documentElement.style.setProperty('--beat', '0');
      return;
    }

    let currentTime = 0;
    if (audioElement && !audioElement.paused && audioElement.currentTime > 0) {
      currentTime = audioElement.currentTime;
    } else {
      currentTime = (performance.now() / 1000) % LOOP_DURATION;
    }

    const currentBeatTotal = Math.floor(currentTime / BEAT_DURATION);
    const beatFraction = (currentTime / BEAT_DURATION) % 1;
    const measureBeat = currentBeatTotal % 4; // 0 = Downbeat, 1 = Snare, 2 = Kick, 3 = Snare

    // Calculate dynamic visual energy for ember flames & HUD lighting
    let energy = 0.18;
    if (beatFraction < 0.26) {
      const attack = 1 - beatFraction / 0.26;
      if (measureBeat === 0) energy = 0.95 * attack;
      else if (measureBeat === 2) energy = 0.82 * attack;
      else energy = 0.65 * attack;
    } else {
      energy = 0.18 + 0.12 * Math.sin(beatFraction * Math.PI * 2);
    }

    document.documentElement.style.setProperty('--beat', energy.toFixed(3));

    // Synchronized rhythmic haptic vibration on beat changes
    if (hapticsEnabled && currentBeatTotal !== lastTriggeredBeat) {
      lastTriggeredBeat = currentBeatTotal;

      try {
        if (measureBeat === 0) {
          // Beat 1: Heavy tactical combat bass thump
          navigator.vibrate?.([24, 20, 16]);
        } else if (measureBeat === 2) {
          // Beat 3: Punchy 808 kick pulse
          navigator.vibrate?.(16);
        } else {
          // Beats 2 & 4: Sharp war snare snap
          navigator.vibrate?.(10);
        }
      } catch {}
    }

    animFrameId = requestAnimationFrame(beatLoop);
  }

  function updateToggleUI() {
    if (!soundToggle) return;
    if (isPlaying) {
      soundToggle.classList.remove('is-muted');
      soundToggle.title = 'Mute Dhurandhar Combat Soundtrack';
    } else if (dhurandharActive) {
      soundToggle.classList.add('is-muted');
      soundToggle.title = 'Play Dhurandhar Combat Soundtrack';
    } else {
      const elapsed = Date.now() - sessionStartTime;
      const remainingMinutes = Math.max(1, Math.ceil((DHURANDHAR_DELAY_MS - elapsed) / 60000));
      soundToggle.classList.add('is-muted');
      soundToggle.title = `Dhurandhar Anthem starts in ${remainingMinutes}m (tap to play now)`;
    }
  }

  // Starts or schedules Dhurandhar audio
  async function startAudio(forceNow = false) {
    userMuted = false;
    audioUnlocked = true;

    const elapsed = Date.now() - sessionStartTime;
    const shouldPlayDhurandhar = forceNow || elapsed >= DHURANDHAR_DELAY_MS;

    if (!shouldPlayDhurandhar) {
      // 7 minutes not yet reached: keep scheduled timer armed
      scheduleDhurandhar();
      updateToggleUI();
      return;
    }

    dhurandharActive = true;
    isPlaying = true;
    clearTimeout(dhurandharTriggerTimer);

    updateMediaSession();
    updateToggleUI();

    let nativePlayed = false;
    if (audioElement) {
      audioElement.volume = 0.72;
      try {
        await audioElement.play();
        nativePlayed = true;
      } catch (err) {
        // Autoplay may be blocked pending gesture
      }
    }

    if (!nativePlayed) {
      startProceduralTacticalLoop();
    } else {
      stopProceduralLoop();
    }

    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(beatLoop);
  }

  function scheduleDhurandhar() {
    if (dhurandharActive || navigator.webdriver) return;

    const elapsed = Date.now() - sessionStartTime;
    const remaining = Math.max(0, DHURANDHAR_DELAY_MS - elapsed);

    clearTimeout(dhurandharTriggerTimer);
    dhurandharTriggerTimer = setTimeout(() => {
      if (!userMuted && !navigator.webdriver) {
        void startAudio(true);
      }
    }, remaining);
  }

  function pauseAudio() {
    userMuted = true;
    isPlaying = false;
    stopProceduralLoop();

    if (audioElement && !audioElement.paused) {
      audioElement.pause();
    }

    updateToggleUI();
    updateMediaSession();
    document.documentElement.style.setProperty('--beat', '0');
  }

  // Dismiss deploy gateway and trigger deployment rumble
  function deployBattlefield() {
    audioUnlocked = true;
    if (hapticsEnabled) {
      try {
        navigator.vibrate?.([45, 30, 35, 25, 50]);
      } catch {}
    }

    // Schedule 7-minute timer from start
    scheduleDhurandhar();
    updateToggleUI();

    if (gateway) {
      gateway.classList.add('deployed');
      setTimeout(() => {
        gateway.style.display = 'none';
      }, 700);
    }
    document.body.classList.add('is-deployed');
  }

  if (gateway) {
    gateway.addEventListener('click', () => {
      deployBattlefield();
    });
  }

  if (deployBtn) {
    deployBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deployBattlefield();
    });
  }

  // In automated test runs (Playwright), instantly deploy without blocking
  if (navigator.webdriver) {
    if (gateway) {
      gateway.classList.add('deployed');
      gateway.style.display = 'none';
    }
    document.body.classList.add('is-deployed');
  }

  // GESTURE UNLOCK: User interaction unlocks audio and arms 7-min Dhurandhar timer
  const ensureUnlocked = () => {
    if (!audioUnlocked && !navigator.webdriver) {
      audioUnlocked = true;
      scheduleDhurandhar();
      updateToggleUI();
    }
  };

  window.addEventListener('touchstart', ensureUnlocked, { passive: true });
  window.addEventListener('touchend', ensureUnlocked, { passive: true });
  window.addEventListener('scroll', ensureUnlocked, { passive: true });
  window.addEventListener('wheel', ensureUnlocked, { passive: true });
  window.addEventListener('keydown', ensureUnlocked, { passive: true });

  window.addEventListener(
    'pointerdown',
    (e) => {
      ensureUnlocked();

      // Tactile button/card haptic response on interaction
      if (
        hapticsEnabled &&
        e.target.closest(
          'button, a, .rank-card, .tab-post, .card, select, input, .match-card, .action-btn',
        )
      ) {
        try {
          navigator.vibrate?.(12);
        } catch {}
      }
    },
    { passive: true },
  );

  // Quick sound mute/unmute toggle
  if (soundToggle) {
    soundToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isPlaying) {
        pauseAudio();
      } else {
        // User explicitly tapped sound toggle: force play immediately!
        void startAudio(true);
      }
      if (hapticsEnabled) {
        try {
          navigator.vibrate?.([15, 20, 15]);
        } catch {}
      }
    });
  }

  // Quick haptics toggle
  if (hapticToggle) {
    hapticToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      hapticsEnabled = !hapticsEnabled;
      hapticToggle.classList.toggle('is-disabled', !hapticsEnabled);
      if (hapticsEnabled) {
        try {
          navigator.vibrate?.([20, 30, 20]);
        } catch {}
      }
    });
  }

  // CONTINUOUS BACKGROUND PLAYBACK SAFEGUARDS:
  // 1. Audio element keeps playing natively when tab is backgrounded.
  // 2. When returning to tab, re-verify playback and resume if needed.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isPlaying && !userMuted && dhurandharActive) {
      if (audioElement && audioElement.paused) {
        void audioElement.play().catch(() => {});
      }
      cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(beatLoop);
    }
  });

  window.addEventListener('focus', () => {
    if (isPlaying && !userMuted && dhurandharActive && audioElement && audioElement.paused) {
      void audioElement.play().catch(() => {});
    }
  });

  window.addEventListener('pageshow', () => {
    if (isPlaying && !userMuted && dhurandharActive && audioElement && audioElement.paused) {
      void audioElement.play().catch(() => {});
    }
  });

  // Watchdog timer: checks every 1000ms to guarantee Dhurandhar is never silenced once active
  clearInterval(watchdogId);
  watchdogId = setInterval(() => {
    if (isPlaying && !userMuted && dhurandharActive && audioElement && audioElement.paused) {
      void audioElement.play().catch(() => {});
    }
  }, 1000);

  // When any video plays on page, duck Dhurandhar to 0.35 instead of pausing it!
  document.addEventListener(
    'play',
    (e) => {
      if (e.target instanceof HTMLVideoElement && audioElement) {
        audioElement.volume = 0.35;
      }
    },
    true,
  );

  document.addEventListener(
    'pause',
    (e) => {
      if (e.target instanceof HTMLVideoElement && audioElement && !userMuted) {
        audioElement.volume = 0.72;
      }
    },
    true,
  );

  // Initialize schedule and UI state
  scheduleDhurandhar();
  updateToggleUI();

  return {
    startAudio,
    pauseAudio,
    triggerTacticalPulse: (pattern = 14) => {
      if (hapticsEnabled) {
        try {
          navigator.vibrate?.(pattern);
        } catch {}
      }
    },
  };
}

// COD Battlefield Audio & Haptics Engine
// Integrates Dhurandhar soundtrack, Web Audio analyser, audio-reactive CSS lighting, and synchronized tactical haptics

let audioCtx = null;
let analyserNode = null;
let sourceNode = null;
let synthOsc = null;
let isPlaying = false;
let isSynthActive = false;
let lastBeatTime = 0;
let avgEnergy = 0;
let prevEnergy = 0;
let animFrameId = 0;

export function setupBattleAudio() {
  const audioElement = document.querySelector('#battle-music');
  const deployBtn = document.querySelector('#btn-deploy');
  const soundToggle = document.querySelector('#battle-sound-toggle');
  const hapticToggle = document.querySelector('#battle-haptic-toggle');

  let hapticsEnabled = true;
  let audioUnlocked = false;

  function initAudioContext() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = new AudioContextClass();
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
  }

  // Synthesizes a high-intensity battlefield tactical bass heartbeat loop if dhurandhar.mp3 is not loaded
  function startProceduralTacticalLoop() {
    if (!audioCtx || isSynthActive) return;
    isSynthActive = true;

    const gainMaster = audioCtx.createGain();
    gainMaster.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gainMaster.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);

    function triggerKick(time) {
      if (!isSynthActive) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, time);
      osc.frequency.exponentialRampToValueAtTime(32, time + 0.18);

      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

      osc.connect(gain);
      gain.connect(gainMaster);

      osc.start(time);
      osc.stop(time + 0.36);
    }

    function triggerHiHat(time) {
      if (!isSynthActive) return;
      const bufferSize = audioCtx.sampleRate * 0.04;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7500;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.12, time);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(gainMaster);

      noise.start(time);
    }

    let nextStepTime = audioCtx.currentTime + 0.05;
    const stepInterval = 0.32; // ~188 BPM tactical war drum rhythm
    let step = 0;

    function scheduler() {
      if (!isSynthActive) return;
      while (nextStepTime < audioCtx.currentTime + 0.2) {
        if (step % 2 === 0) triggerKick(nextStepTime);
        triggerHiHat(nextStepTime);
        step++;
        nextStepTime += stepInterval;
      }
      setTimeout(scheduler, 50);
    }
    scheduler();
  }

  function analyzeLoop(now) {
    if (!isPlaying && !isSynthActive) {
      document.documentElement.style.setProperty('--beat', '0');
      return;
    }

    if (analyserNode) {
      const data = new Uint8Array(analyserNode.frequencyBinCount);
      analyserNode.getByteFrequencyData(data);

      // Low frequency sub-bass bins
      let subBass = 0;
      for (let i = 1; i <= 6; i++) subBass += data[i];
      const energy = Math.min(1, subBass / (6 * 230));

      avgEnergy = avgEnergy * 0.9 + energy * 0.1;

      // Update CSS custom property for dynamic fire lighting
      document.documentElement.style.setProperty('--beat', energy.toFixed(3));

      // Tactical haptic pulse on beat peaks
      if (
        hapticsEnabled &&
        energy > 0.22 &&
        energy > avgEnergy * 1.28 &&
        energy - prevEnergy > 0.03 &&
        now - lastBeatTime > 400
      ) {
        lastBeatTime = now;
        try {
          navigator.vibrate?.(10);
        } catch {}
      }

      prevEnergy = energy;
    }

    animFrameId = requestAnimationFrame(analyzeLoop);
  }

  async function startAudio() {
    initAudioContext();
    if (audioCtx?.state === 'suspended') {
      await audioCtx.resume();
    }

    audioUnlocked = true;
    isPlaying = true;

    // Try playing dhurandhar.mp3
    if (audioElement) {
      audioElement.volume = 0.55;
      try {
        if (!sourceNode && audioCtx) {
          sourceNode = audioCtx.createMediaElementSource(audioElement);
          sourceNode.connect(analyserNode);
          analyserNode.connect(audioCtx.destination);
        }
        await audioElement.play();
      } catch (err) {
        // Fallback to rich procedural tactical synth audio
        startProceduralTacticalLoop();
      }
    } else {
      startProceduralTacticalLoop();
    }

    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(analyzeLoop);
  }

  function pauseAudio() {
    isPlaying = false;
    isSynthActive = false;
    if (audioElement && !audioElement.paused) {
      audioElement.pause();
    }
    document.documentElement.style.setProperty('--beat', '0');
  }

  // Deploy button triggers sound, haptic pulse, and unlocks the battlefield
  if (deployBtn) {
    deployBtn.addEventListener('click', async () => {
      // Haptic deployment pulse
      try {
        navigator.vibrate?.([15, 35, 20]);
      } catch {}

      await startAudio();

      const gateway = document.querySelector('#deploy-gateway');
      if (gateway) {
        gateway.classList.add('deployed');
        setTimeout(() => {
          gateway.style.display = 'none';
        }, 800);
      }
      document.body.classList.add('is-deployed');
    });

    if (navigator.webdriver) {
      const gateway = document.querySelector('#deploy-gateway');
      if (gateway) {
        gateway.classList.add('deployed');
        gateway.style.display = 'none';
      }
      document.body.classList.add('is-deployed');
    }
  }

  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      if (isPlaying || isSynthActive) {
        pauseAudio();
        soundToggle.classList.add('is-muted');
      } else {
        startAudio();
        soundToggle.classList.remove('is-muted');
      }
    });
  }

  if (hapticToggle) {
    hapticToggle.addEventListener('click', () => {
      hapticsEnabled = !hapticsEnabled;
      hapticToggle.classList.toggle('is-disabled', !hapticsEnabled);
      if (hapticsEnabled) {
        try {
          navigator.vibrate?.(12);
        } catch {}
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (isPlaying || isSynthActive)) {
      pauseAudio();
    }
  });

  return {
    startAudio,
    pauseAudio,
    triggerTacticalPulse: (pattern = 10) => {
      if (hapticsEnabled) {
        try {
          navigator.vibrate?.(pattern);
        } catch {}
      }
    },
  };
}

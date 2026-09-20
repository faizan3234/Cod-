// COD 81-Frame WebP Canvas & Battlefield Particle Engine (Omnitrix-style architecture)
const FRAME_COUNT = 81;
const FLASH_FRAMES = new Set([12, 28, 47, 65, 78]);

export function setupBattleSequence() {
  const section = document.querySelector('#battle-sequence');
  const canvas = document.querySelector('#battle-canvas');
  const flashOverlay = document.querySelector('#battle-flash');
  const scrollPrompt = document.querySelector('#battle-scroll-prompt');
  const container = document.querySelector('#battle-container');

  if (!section || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const frameImages = new Array(FRAME_COUNT).fill(null);
  const loadedFrames = new Set();
  let currentFrameIndex = 0;
  let renderQueued = false;
  let isStickyActive = false;
  let lastTriggeredFlash = -1;

  // Particle Engine State (independent real-time ambient layer)
  const particles = [];
  const PARTICLE_COUNT = 36;
  let particleAnimFrame = 0;
  let lastParticleTime = performance.now();

  function initParticles(width, height) {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: height + Math.random() * 60,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -(1.2 + Math.random() * 2.2),
        size: 1.5 + Math.random() * 3.2,
        alpha: 0.2 + Math.random() * 0.7,
        decay: 0.003 + Math.random() * 0.007,
        hue: Math.random() > 0.3 ? 32 + Math.random() * 15 : 12 + Math.random() * 18,
        sparkle: Math.random() * Math.PI * 2,
      });
    }
  }

  // Cover scaling: guarantees zero letterboxing and zero white borders
  function drawCover(image, w, h) {
    if (!image || !image.complete || !image.naturalWidth) return;
    const imgRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = w / h;
    let dw, dh, dx, dy;

    if (canvasRatio > imgRatio) {
      dw = w;
      dh = w / imgRatio;
      dx = 0;
      dy = (h - dh) * 0.5;
    } else {
      dh = h;
      dw = h * imgRatio;
      dx = (w - dw) * 0.5;
      dy = 0;
    }

    ctx.drawImage(image, dx, dy, dw, dh);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(w, h);
      renderFrame(currentFrameIndex, true);
    }
  }

  function loadFrame(index) {
    if (index < 0 || index >= FRAME_COUNT) return Promise.resolve(null);
    if (frameImages[index]) return Promise.resolve(frameImages[index]);

    const frameNum = 1 + index * 3;
    const src = `/cod_frames/scene${String(frameNum).padStart(5, '0')}.webp`;
    const img = new Image();
    img.decoding = 'async';
    frameImages[index] = img;

    return new Promise((resolve) => {
      img.onload = () => {
        loadedFrames.add(index);
        if (index === currentFrameIndex) {
          requestRender();
        }
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = src;
    });
  }

  // Progressive preloading pipeline
  async function startPreloading() {
    // 1. Initial frame
    await loadFrame(0);

    // 2. Initial sequence
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 80));
    idle(() => {
      for (let i = 1; i <= 15; i++) {
        loadFrame(i);
      }
    });

    // 3. Remainder
    setTimeout(() => {
      for (let i = 16; i < FRAME_COUNT; i++) {
        loadFrame(i);
      }
    }, 1100);
  }

  function renderFrame(index, force = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.fillStyle = '#030303';
    ctx.fillRect(0, 0, w, h);

    let img = frameImages[index];
    if (!img || !img.complete || !img.naturalWidth) {
      for (let offset = 1; offset < 10; offset++) {
        if (index - offset >= 0 && loadedFrames.has(index - offset)) {
          img = frameImages[index - offset];
          break;
        }
        if (index + offset < FRAME_COUNT && loadedFrames.has(index + offset)) {
          img = frameImages[index + offset];
          break;
        }
      }
    }

    if (img && img.complete && img.naturalWidth) {
      drawCover(img, w, h);
    }

    // Top and bottom cinematic gradients for depth & seamless transitions
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(3,3,3,0.75)');
    grad.addColorStop(0.18, 'rgba(3,3,3,0)');
    grad.addColorStop(0.82, 'rgba(3,3,3,0.15)');
    grad.addColorStop(1, 'rgba(3,3,3,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Milestone muzzle flashes & subtle shake
    if (FLASH_FRAMES.has(index) && lastTriggeredFlash !== index) {
      lastTriggeredFlash = index;
      triggerMuzzleFlash();
    }
  }

  function triggerMuzzleFlash() {
    if (!flashOverlay) return;
    flashOverlay.classList.add('active');
    try {
      navigator.vibrate?.(8);
    } catch {}

    if (container) {
      const shakeX = (Math.random() - 0.5) * 4;
      const shakeY = (Math.random() - 0.5) * 3;
      container.style.transform = `translate3d(${shakeX}px, ${shakeY}px, 0)`;
    }

    setTimeout(() => {
      flashOverlay.classList.remove('active');
      if (container) container.style.transform = 'translate3d(0, 0, 0)';
    }, 55);
  }

  function updateParticles(now) {
    const dt = Math.min((now - lastParticleTime) / 1000, 0.1);
    lastParticleTime = now;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (isStickyActive) {
      renderFrame(currentFrameIndex);

      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.sparkle += dt * 4;

        if (p.alpha <= 0 || p.y < -20 || p.x < -20 || p.x > w + 20) {
          p.x = Math.random() * w;
          p.y = h + Math.random() * 30;
          p.vx = (Math.random() - 0.5) * 1.5;
          p.vy = -(1.2 + Math.random() * 2.4);
          p.size = 1.5 + Math.random() * 3.2;
          p.alpha = 0.3 + Math.random() * 0.7;
          p.decay = 0.003 + Math.random() * 0.008;
          p.hue = Math.random() > 0.3 ? 34 + Math.random() * 14 : 12 + Math.random() * 20;
        }

        const size = p.size * (0.8 + 0.3 * Math.sin(p.sparkle));
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 62%, ${Math.max(0, p.alpha)})`;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      ctx.restore();
    }

    particleAnimFrame = requestAnimationFrame(updateParticles);
  }

  function requestRender() {
    if (!renderQueued) {
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        renderFrame(currentFrameIndex);
      });
    }
  }

  function onScroll() {
    const rect = section.getBoundingClientRect();
    const travel = Math.max(1, section.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / travel));

    isStickyActive = rect.top <= 2 && rect.bottom >= window.innerHeight * 0.1;

    const newIndex = Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));

    for (let d = 1; d <= 3; d++) {
      if (newIndex + d < FRAME_COUNT) loadFrame(newIndex + d);
      if (newIndex - d >= 0) loadFrame(newIndex - d);
    }

    if (newIndex !== currentFrameIndex) {
      currentFrameIndex = newIndex;
      requestRender();
    }

    if (scrollPrompt) {
      if (progress < 0.02) {
        scrollPrompt.style.opacity = '1';
        scrollPrompt.style.transform = 'translateY(0)';
      } else if (progress > 0.08) {
        scrollPrompt.style.opacity = '0';
        scrollPrompt.style.transform = 'translateY(-15px)';
      } else {
        const fade = (0.08 - progress) / 0.06;
        scrollPrompt.style.opacity = String(Math.max(0, fade));
      }
    }
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

  resizeCanvas();
  startPreloading();
  onScroll();
  particleAnimFrame = requestAnimationFrame(updateParticles);
}

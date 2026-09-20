// COD 240-Frame WebP Dual-Canvas Battlefield Engine (Omnitrix-style architecture)
// Guaranteed zero blackness: continuous frame scrubbing with nearest-frame anchor caching & fractional crossfade
const FRAME_COUNT = 240;
const FLASH_FRAMES = new Set([35, 75, 120, 165, 210]);

export function setupBattleSequence() {
  const section = document.querySelector('#battle-sequence');
  const canvas = document.querySelector('#battle-canvas');
  const particleCanvas = document.querySelector('#particles-canvas');
  const flashOverlay = document.querySelector('#battle-flash');
  const scrollPrompt = document.querySelector('#battle-scroll-prompt');
  const container = document.querySelector('#battle-container');

  if (!section || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const ctxParticles = particleCanvas ? particleCanvas.getContext('2d', { alpha: true }) : null;

  // Fallback poster: loaded immediately to guarantee canvas has initial artwork
  const fallbackPoster = new Image();
  fallbackPoster.src = '/media/cod-mobile-hero.jpg';
  fallbackPoster.onload = () => {
    if (!lastDrawnImage) {
      renderCurrentState(true);
    }
  };

  const frameImages = new Array(FRAME_COUNT).fill(null);
  const loadedFrames = new Set();
  let lastDrawnImage = null;
  let currentExactProgress = 0;
  let currentFrameIndex = 0;
  let renderedFrameIndex = -1;
  let renderQueued = false;
  let isStickyActive = false;
  let lastTriggeredFlash = -1;

  // Particle Engine State (independent real-time transparent layer)
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

  // Cover scaling: guarantees zero letterboxing and zero borders
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

      if (particleCanvas && ctxParticles) {
        particleCanvas.width = Math.round(w * dpr);
        particleCanvas.height = Math.round(h * dpr);
        particleCanvas.style.width = w + 'px';
        particleCanvas.style.height = h + 'px';
        ctxParticles.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      initParticles(w, h);
      renderCurrentState(true);
    }
  }

  function loadFrame(index) {
    if (index < 0 || index >= FRAME_COUNT) return Promise.resolve(null);
    if (frameImages[index]) return Promise.resolve(frameImages[index]);

    const src = `/cod_video_frames/scene${String(index + 1).padStart(5, '0')}.webp`;
    const img = new Image();
    img.decoding = 'async';
    frameImages[index] = img;

    return new Promise((resolve) => {
      img.onload = () => {
        loadedFrames.add(index);
        // If this frame is within visible distance, refresh immediately
        if (Math.abs(index - currentFrameIndex) <= 12) {
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

  // Preloading pipeline: anchors whole timeline first, then prioritizes current viewport
  async function startPreloading() {
    // 1. First 2 frames for instant initial render
    await Promise.all([loadFrame(0), loadFrame(1)]);
    renderCurrentState(true);

    // 2. Preload timeline anchor keyframes (every 8 frames) across the entire video
    // 30 tiny images (~500KB total) guarantees an anchor is within 4 frames of ANY scroll position!
    for (let i = 0; i < FRAME_COUNT; i += 8) {
      loadFrame(i);
    }

    // 3. Preload initial consecutive cluster for instant top-scroll smoothness
    for (let i = 2; i < 18; i++) {
      loadFrame(i);
    }

    // 4. Fill in remaining frames in background idle chunks
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 120));
    idle(() => {
      let nextIndex = 0;
      const fillRest = () => {
        if (nextIndex >= FRAME_COUNT) return;
        const end = Math.min(FRAME_COUNT, nextIndex + 24);
        for (let i = nextIndex; i < end; i++) {
          loadFrame(i);
        }
        nextIndex = end;
        setTimeout(fillRest, 140);
      };
      setTimeout(fillRest, 300);
    });
  }

  // Canvas 1: Zero-black rendering with nearest-anchor fallback and smooth crossfading
  function renderCurrentState(force = false) {
    const exactFrame = currentExactProgress * (FRAME_COUNT - 1);
    const current = Math.floor(exactFrame);
    const next = Math.min(FRAME_COUNT - 1, current + 1);
    const mix = exactFrame - current;

    if (!force && current === renderedFrameIndex && mix < 0.03) return;
    renderedFrameIndex = current;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Determine the absolute best frame to draw
    let bestImg = null;
    if (frameImages[current]?.complete && frameImages[current]?.naturalWidth) {
      bestImg = frameImages[current];
    } else if (loadedFrames.size > 0) {
      // Find closest loaded frame across the entire timeline
      let closestDist = Infinity;
      let closestIdx = -1;
      for (const idx of loadedFrames) {
        const d = Math.abs(idx - current);
        if (d < closestDist) {
          closestDist = d;
          closestIdx = idx;
        }
      }
      if (closestIdx >= 0) {
        bestImg = frameImages[closestIdx];
      }
    }

    // If still none, use last successfully rendered frame or hero poster (NEVER BLACK!)
    if (!bestImg || !bestImg.complete || !bestImg.naturalWidth) {
      bestImg = lastDrawnImage || (fallbackPoster.complete ? fallbackPoster : null);
    }

    ctx.globalAlpha = 1;
    if (bestImg) {
      drawCover(bestImg, w, h);
      lastDrawnImage = bestImg;
    }

    // Fractional crossfade into next frame if available
    if (mix > 0.02) {
      const nextImg = frameImages[next];
      if (nextImg?.complete && nextImg?.naturalWidth) {
        ctx.globalAlpha = mix;
        drawCover(nextImg, w, h);
      }
    }
    ctx.globalAlpha = 1;

    // Cinematic vignette gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(3,3,3,0.45)');
    grad.addColorStop(0.18, 'rgba(3,3,3,0)');
    grad.addColorStop(0.85, 'rgba(3,3,3,0.08)');
    grad.addColorStop(1, 'rgba(3,3,3,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Milestone muzzle flashes & subtle shake
    if (FLASH_FRAMES.has(current) && lastTriggeredFlash !== current) {
      lastTriggeredFlash = current;
      triggerMuzzleFlash();
    }
  }

  function triggerMuzzleFlash() {
    if (!flashOverlay) return;
    flashOverlay.classList.add('active');
    try {
      navigator.vibrate?.(12);
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

  // Canvas 2: Real-time particle simulation at 60 FPS without redrawing Canvas 1
  function updateParticles(now) {
    const dt = Math.min((now - lastParticleTime) / 1000, 0.1);
    lastParticleTime = now;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (ctxParticles && isStickyActive) {
      ctxParticles.clearRect(0, 0, w, h);

      ctxParticles.save();
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
        ctxParticles.beginPath();
        ctxParticles.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctxParticles.fillStyle = `hsla(${p.hue}, 100%, 62%, ${Math.max(0, p.alpha)})`;
        ctxParticles.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
        ctxParticles.shadowBlur = 6;
        ctxParticles.fill();
      }
      ctxParticles.restore();
    }

    particleAnimFrame = requestAnimationFrame(updateParticles);
  }

  function requestRender() {
    if (!renderQueued) {
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        renderCurrentState();
      });
    }
  }

  function onScroll() {
    const rect = section.getBoundingClientRect();
    const travel = Math.max(1, section.offsetHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / travel));

    currentExactProgress = progress;
    isStickyActive = rect.top <= 2 && rect.bottom >= window.innerHeight * 0.05;

    const newIndex = Math.min(FRAME_COUNT - 1, Math.floor(progress * (FRAME_COUNT - 1)));

    // Eagerly prefetch nearby neighborhood frames around current target
    for (let d = 1; d <= 6; d++) {
      if (newIndex + d < FRAME_COUNT) loadFrame(newIndex + d);
      if (newIndex - d >= 0) loadFrame(newIndex - d);
    }

    if (newIndex !== currentFrameIndex || Math.abs(currentExactProgress - progress) > 0.001) {
      currentFrameIndex = newIndex;
      requestRender();
    }

    if (scrollPrompt) {
      if (progress < 0.015) {
        scrollPrompt.style.opacity = '1';
        scrollPrompt.style.transform = 'translateY(0)';
      } else if (progress > 0.06) {
        scrollPrompt.style.opacity = '0';
        scrollPrompt.style.transform = 'translateY(-15px)';
      } else {
        const fade = (0.06 - progress) / 0.045;
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

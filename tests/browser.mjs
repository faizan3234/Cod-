import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { startServer } from '../scripts/server.mjs';

const output = path.resolve('test-results');
await mkdir(output, { recursive: true });
const temp = await mkdtemp(path.join(tmpdir(), 'solo-league-test-'));
const server = await startServer({ dataDir: temp, port: 5198, apiPort: 0 });
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    hasTouch: true,
  });
  await context.addInitScript(() => {
    window.__hapticCalls = [];
    window.__toneCount = 0;
    window.__audioContexts = 0;
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern) => {
        window.__hapticCalls.push(pattern);
        return true;
      },
    });
    const NativeAudio = window.AudioContext;
    if (NativeAudio)
      window.AudioContext = class extends NativeAudio {
        constructor(...args) {
          super(...args);
          window.__audioContexts++;
        }
        createOscillator() {
          window.__toneCount++;
          return super.createOscillator();
        }
      };
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', async (response) => {
    if (
      response.status() >= 400 &&
      response.url().includes('/.netlify/functions/')
    ) {
      console.log('API response', response.status(), await response.text());
    }
  });
  page.setDefaultTimeout(15_000);
  await page.goto(server.url);
  await page.waitForFunction(
    () => document.querySelector('#stat-total').textContent === '21',
  );
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#stat-complete').textContent(), '0');
  assert.equal(await page.locator('#standings-body tr').count(), 7);
  await page.screenshot({ path: path.join(output, 'desktop-overview.png') });
  for (const [width, height] of [
    [320, 568],
    [360, 800],
    [375, 812],
    [390, 844],
    [393, 852],
    [412, 915],
    [430, 932],
    [844, 390],
    [932, 430],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(output, `phone-${width}x${height}.png`),
    });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          right: el.getBoundingClientRect().right,
        }))
        .slice(0, 12),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Page overflow at ${width}×${height}: ${JSON.stringify(overflow)}`,
    );
    await page.screenshot({
      path: path.join(output, `phone-${width}x${height}.png`),
    });
    await page.locator('#cinematic').scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.querySelector('#arena-video').readyState >= 1,
    );
    const rect = await page.locator('.cinema-stage').boundingBox();
    assert(
      rect.width <= width && rect.height > 90,
      'The video frame fits the phone',
    );
  }
  console.log(
    'PASS: initial league and desktop / portrait / landscape / small-phone layouts',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => window.__audioContexts), 0);
  await page.locator('#settings-open').click();
  await page.goBack();
  await page.waitForFunction(
    () => !document.querySelector('#settings-sheet').open,
  );
  await page.locator('#settings-open').click();
  assert.equal(await page.locator('#setting-sound').isChecked(), false);
  await page.locator('#setting-sound').check();
  await page.locator('#setting-motion').uncheck();
  assert(
    await page.evaluate(() =>
      document.documentElement.classList.contains('reduced-motion'),
    ),
  );
  await page.locator('#setting-motion').check();
  await page.screenshot({
    path: path.join(output, 'phone-settings.png'),
    animations: 'disabled',
  });
  await page.locator('#settings-close').click();
  await page.waitForFunction(() => !history.state?.__soloSheet);
  await page.evaluate(() => {
    window.__hapticCalls = [];
    window.__toneCount = 0;
  });
  await page.locator('.phone-tabs [data-tab=league]').click();
  await page.waitForFunction(() => location.hash === '#league');
  await page.locator('.phone-tabs [data-tab=matches]').click();
  await page.waitForFunction(() => location.hash === '#matches');
  await page.goBack();
  await page.waitForFunction(() => location.hash === '#league');
  const manifest = await (
    await page.request.get(server.url + '/manifest.webmanifest')
  ).json();
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons)
    assert.equal((await page.request.get(server.url + icon.src)).status(), 200);
  assert.deepEqual(await page.evaluate(() => window.__hapticCalls), []);
  assert.equal(await page.evaluate(() => window.__toneCount), 0);
  await page.locator('[data-action=filters]').tap();
  await page.locator('#filters-form [name=player]').selectOption('bowdownbro');
  await page.locator('#filters-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  assert.equal(await page.locator('#match-grid .match-card').count(), 6);
  await page.locator('[data-action=filters]').click();
  await page.locator('#reset-filters').click();
  await page.locator('#filters-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  await page.locator('[data-action=match-detail]').first().click();
  await page.locator('.pending-detail').waitFor();
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  assert(await page.locator('.charter-card button').isDisabled());
  await page.locator('.hero-actions a[href="#cinematic"]').click();
  await page.waitForFunction(() =>
    document.body.classList.contains('cinema-active'),
  );
  const cinema = await page.locator('.cinema-stage').boundingBox();
  assert.equal(Math.round(cinema.width), 390);
  assert.equal(Math.round(cinema.height), 844);
  assert.equal(await page.locator('.site-header').isVisible(), false);
  assert.equal(await page.locator('.phone-tabs').isVisible(), false);
  await page.screenshot({ path: path.join(output, 'phone-cinema.png') });
  assert(await page.locator('.cinema-skip').isVisible());
  await page.locator('.cinema-skip').click();
  await page.waitForFunction(
    () =>
      location.hash === '#league' &&
      !document.body.classList.contains('cinema-active'),
  );
  assert(await page.locator('.phone-tabs').isVisible());
  console.log(
    'PASS: settings, hash navigation with Back, PWA assets and full-screen cinema',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() =>
    window.scrollTo(
      0,
      document.querySelector('#cinematic').offsetTop -
        document.querySelector('.site-header').offsetHeight +
        100,
    ),
  );
  await page.locator('#cinema-play').click();
  await page.waitForFunction(() => {
    const v = document.querySelector('#arena-video');
    return !v.paused && !v.muted && v.currentTime > 0.2;
  });
  await page.locator('#cinema-mute').click();
  assert(await page.locator('#arena-video').evaluate((v) => v.muted));
  await page.locator('#cinema-mode').click();
  assert(
    await page.locator('#arena-video').evaluate((v) => v.paused && v.muted),
  );
  await page.evaluate(() => window.scrollBy(0, 130));
  await page.waitForFunction(
    () => document.querySelector('#arena-video').currentTime > 1,
  );
  console.log(
    'PASS: supplied arena video plays with sound and returns to silent scroll control',
  );

  await page
    .getByRole('button', { name: 'Queue a match', exact: true })
    .click();
  await page.locator('#schedule-form [name=a]').fill('Bow Down Bro');
  await page.locator('#schedule-form [name=b]').fill('SnowStorm');
  await page.locator('#schedule-form button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  const scoreboard = path.join(temp, 'synthetic-scoreboard.png');
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="700"><rect width="1400" height="700" fill="white"/><g fill="black" font-family="DejaVu Sans"><text x="90" y="80" font-size="25">SYNTHETIC TEST ONLY - NOT A REAL RESULT</text><text x="90" y="170" font-size="48">FINAL SCOREBOARD</text><text x="90" y="315" font-size="54">bowdownbro</text><text x="1150" y="315" font-size="54">6</text><text x="90" y="440" font-size="54">snowstorm</text><text x="1150" y="440" font-size="54">4</text><text x="90" y="600" font-size="28">Map: Test Arena</text></g></svg>`,
    ),
  )
    .png()
    .toFile(scoreboard);
  await page.locator('.hero-actions [data-action=upload]').click();
  await page.locator('#score-file').setInputFiles(scoreboard);
  await page.locator('#result-form').waitFor({ timeout: 90_000 });
  assert.equal(
    await page.locator('#result-form [name=playerA]').inputValue(),
    'bowdownbro',
  );
  assert.equal(
    await page.locator('#result-form [name=playerB]').inputValue(),
    'snowstorm',
  );
  assert.equal(
    await page.locator('#result-form [name=scoreA]').inputValue(),
    '6',
  );
  assert.equal(
    await page.locator('#result-form [name=scoreB]').inputValue(),
    '4',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(output, 'ocr-review-phone.png'),
    animations: 'disabled',
    timeout: 30_000,
  });
  await page
    .locator('#result-form [name=map]')
    .fill('Test Arena - restored draft');
  await page.waitForFunction(async () => {
    const d = await import('/lib/draft.js');
    return (await d.readDraft())?.values?.map === 'Test Arena - restored draft';
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#stat-complete').textContent === '0',
  );
  await page.locator('#draft-banner [data-action=resume]').click();
  await page.locator('#result-form').waitFor();
  assert.equal(
    await page.locator('#result-form [name=map]').inputValue(),
    'Test Arena - restored draft',
  );
  await page.locator('#result-form [name=map]').focus();
  await page.setViewportSize({ width: 390, height: 520 });
  await page
    .locator('#result-form button[type=submit]')
    .scrollIntoViewIfNeeded();
  assert(await page.locator('#result-form button[type=submit]').isVisible());
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: path.join(output, 'phone-keyboard-height.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#result-form button[type=submit]').click();
  await page.locator('#confirm-form').waitFor();
  assert.equal(
    await page.locator('#confirm-form [name=attested]').isChecked(),
    false,
  );
  assert.equal(
    await page.locator('#post-steps [aria-current]').textContent(),
    '3 · Confirm',
  );
  await page.screenshot({
    path: path.join(output, 'phone-confirmation.png'),
    animations: 'disabled',
  });
  await context.setOffline(true);
  await page.waitForFunction(
    () => document.querySelector('#header-live').dataset.state === 'offline',
  );
  await page.locator('#confirm-form [name=attested]').check();
  await page.locator('#confirm-form button[type=submit]').click();
  await page.locator('#confirm-form .form-error:not([hidden])').waitFor();
  assert.match(
    await page.locator('#confirm-form .form-error').textContent(),
    /offline/i,
  );
  await context.setOffline(false);
  await page.waitForFunction(
    () => document.querySelector('#header-live').dataset.state === 'live',
  );
  let saveAttempts = 0;
  await page.route(
    '**/.netlify/functions/league?action=result',
    async (route) => {
      saveAttempts++;
      if (saveAttempts === 1) {
        const response = await route.fetch();
        assert.equal(response.status(), 201);
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.abort('failed');
      } else await route.continue();
    },
  );
  await page.locator('#confirm-form [name=attested]').check();
  await page.locator('#confirm-form button[type=submit]').click();
  await page.locator('#receipt-done').waitFor();
  assert.equal(saveAttempts, 2);
  assert(
    (await page.evaluate(() => window.__hapticCalls)).some(
      (p) => JSON.stringify(p) === '[12,35,18]',
    ),
  );
  assert(await page.evaluate(() => window.__toneCount >= 2));
  assert.match(
    await page.locator('#modal-title').textContent(),
    /RESULT LOCKED/,
  );
  assert.equal(
    await page.locator('#post-steps [aria-current]').textContent(),
    '4 · Receipt',
  );
  await page.screenshot({ path: path.join(output, 'phone-receipt.png') });
  assert(await page.locator('#draft-banner').isHidden());
  const receiptText = await page.locator('.receipt-id').textContent();
  await page.locator('#receipt-view-match').click();
  await page.locator('[data-action=receipt]').click();
  assert.equal(await page.locator('.receipt-id').textContent(), receiptText);
  await page.locator('#receipt-done').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  assert.equal(await page.locator('#stat-complete').textContent(), '1');
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#stat-complete').textContent === '1',
  );
  assert(
    (await page.locator('#standings-body tr').first().textContent()).includes(
      'bowdownbro',
    ),
  );
  assert(
    (await page.locator('#crown-card').textContent()).includes(
      'A CROWN TO BE EARNED',
    ),
  );
  const otherContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    other = await otherContext.newPage();
  await other.goto(server.url);
  await other.waitForFunction(
    () => document.querySelector('#stat-complete').textContent === '1',
  );
  await other.locator('[data-filter=completed]').click();
  await other.locator('[data-action=evidence]').first().click();
  await other.locator('.review-image').waitFor();
  await other.waitForFunction(() => {
    const img = document.querySelector('.review-image');
    return img.complete && img.naturalWidth > 0;
  });
  await other.locator('#modal-close').click();
  await page
    .getByRole('button', { name: 'Queue a match', exact: true })
    .click();
  await page.locator('#schedule-form [name=a]').fill('snowstorm');
  await page.locator('#schedule-form [name=b]').fill('bowdownbro');
  await page.locator('#schedule-form button[type=submit]').click();
  await page.locator('#schedule-form .form-error:not([hidden])').waitFor();
  assert.match(
    await page.locator('#schedule-form .form-error').textContent(),
    /already/,
  );
  await page.locator('#modal-close').click();
  console.log(
    'PASS: OCR, draft recovery, offline protection, dropped-response retry, receipt, refresh, shared results and duplicate rejection',
  );

  await page.locator('[data-action=video]').first().click();
  await page
    .locator('#video-form [name=file]')
    .setInputFiles(path.resolve('public/arena.mp4'));
  await page.locator('#video-form [name=title]').fill('Isolated test upload');
  await page.locator('#video-form [name=playerId]').selectOption('bowdownbro');
  await page.locator('#video-form [name=permission]').check();
  await page.locator('#video-form button[type=submit]').click();
  await page.waitForFunction(
    () => !document.querySelector('#modal').open,
    {},
    { timeout: 60_000 },
  );
  await page.locator('.clip-card').waitFor();
  await page.locator('.clip-card [data-reaction=fire]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.clip-card [data-reaction=fire]')
        .getAttribute('aria-pressed') === 'true',
  );
  await other.waitForFunction(
    () => document.querySelectorAll('.clip-card').length === 1,
    {},
    { timeout: 15_000 },
  );
  await other.locator('.clip-card [data-reaction=gg]').click();
  await other.waitForFunction(
    () =>
      document
        .querySelector('.clip-card [data-reaction=gg]')
        .getAttribute('aria-pressed') === 'true',
  );
  await page.locator('#refresh').click();
  await page.waitForFunction(() =>
    document
      .querySelector('.clip-card [data-reaction=gg]')
      .textContent.includes('1'),
  );
  const clip = page.locator('.clip-card video');
  await clip.scrollIntoViewIfNeeded();
  await clip.evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.waitForFunction(
    () => document.querySelector('.clip-card video').currentTime > 0.2,
  );
  await clip.evaluate((v) => v.pause());
  console.log(
    'PASS: chunked video upload, native range playback and shared reactions',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#league').scrollIntoViewIfNeeded();
  await page.locator('#phone-standings .rank-card').first().click();
  assert(await page.locator('.player-detail-sheet').isVisible());
  await page.screenshot({ path: path.join(output, 'phone-player-detail.png') });
  await page.locator('#modal-close').click();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: path.join(output, 'phone-standings.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() =>
    document.documentElement.classList.contains('reduced-motion'),
  );
  const before = await page
    .locator('#arena-video')
    .evaluate((v) => v.currentTime);
  await page.evaluate(() => window.scrollBy(0, 100));
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator('#arena-video').evaluate((v) => v.currentTime),
    before,
  );
  assert.deepEqual(errors, []);
  console.log('PASS: reduced motion, no browser runtime errors');
  // Check the production offline worker in its own browser profile.
  const pwaContext = await browser.newContext(),
    pwa = await pwaContext.newPage();
  await pwaContext.addInitScript(() =>
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      configurable: true,
    }),
  );
  await pwa.goto(server.url);
  await pwa.locator('#settings-open').click();
  assert(await pwa.locator('#setting-haptics').isDisabled());
  await pwa.locator('#settings-close').click();
  await pwa.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await pwa.waitForFunction(() => !!navigator.serviceWorker.controller);
  await pwaContext.setOffline(true);
  await pwa.reload();
  assert.match(await pwa.locator('h1').textContent(), /Back in a moment/);
  await pwaContext.setOffline(false);
  await pwa.getByRole('button', { name: 'Try again' }).click();
  await pwa.waitForFunction(
    () => document.querySelector('#stat-complete')?.textContent === '1',
  );
  await pwaContext.close();
  console.log(
    'PASS: offline PWA fallback and online recovery retain shared results',
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}

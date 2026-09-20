import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from '../scripts/server.mjs';
import { standings, leagueSummary } from '../lib/league.js';

// The supplied screenshot is an isolated test fixture, never a seeded league result.
const temp = await mkdtemp(path.join(tmpdir(), 'solo-real-sample-'));
const output = path.resolve('test-results');
await mkdir(output, { recursive: true });
let server = await startServer({ dataDir: temp, port: 5199, apiPort: 0 });
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
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await context.addInitScript(() => {
    window.__beatPulses = [];
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern) => {
        window.__beatPulses.push({ pattern, time: performance.now() });
        return true;
      },
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(20_000);
  await page.goto(server.url);
  await page.waitForFunction(
    () => document.querySelector('#stat-total').textContent === '21',
  );
  assert.equal(await page.locator('#stat-complete').textContent(), '0');
  await page.evaluate(() => document.fonts.ready);
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
    const geometry = await page.evaluate(() => {
      const title = document.querySelector('.lobby-hero h1');
      return {
        titleHeight: title.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(title).lineHeight),
        ctaBottom: document
          .querySelector('.hero-actions .button')
          .getBoundingClientRect().bottom,
        navTop: document.querySelector('.phone-tabs').getBoundingClientRect()
          .top,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert(!geometry.overflow, `No overflow at ${width}×${height}`);
    assert(
      geometry.titleHeight <= geometry.lineHeight * 2.1,
      `Heading stays on two lines at ${width}`,
    );
    assert(
        geometry.ctaBottom <= geometry.navTop,
        `Post action clears navigation at ${width}`,
      );
    await page.screenshot({
      path: path.join(output, `immersive-${width}x${height}.png`),
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  console.log(
    'PASS: immersive layout at nine phone sizes; heading, reachable Post action and no overflow',
  );
  await page.locator('.tab-post').click();
  await page
    .locator('#score-file')
    .setInputFiles(path.resolve('tests/fixtures/cod-result-zoo.jpeg'));
  await page.locator('#result-form').waitFor({ timeout: 90_000 });
  for (const [name, value] of Object.entries({
    playerA: 'rizwanstriker',
    playerB: 'bowdownbro',
    scoreA: '5',
    scoreB: '1',
  }))
    assert.equal(
      await page.locator(`#result-form [name=${name}]`).inputValue(),
      value,
    );
  assert.match(
    await page.locator('#result-form .notice').first().textContent(),
    /Confirm.*identities/,
  );
  assert.equal(
    await page.locator('#stat-complete').textContent(),
    '0',
    'Extraction does not post a match',
  );
  await page.screenshot({
    path: path.join(output, 'supplied-sample-review.png'),
  });
  await page.locator('#result-form [name=map]').fill('Zoo'); // optional map checked by the uploader
  await page.locator('#result-form button[type=submit]').click();
  await page.locator('#confirm-form [name=attested]').check();
  await page.locator('#confirm-form button[type=submit]').click();
  await page.locator('#receipt-done').waitFor();
  assert.match(
    await page.locator('.receipt-score').textContent(),
    /5\s*—\s*1/,
  );
  await page.screenshot({
    path: path.join(output, 'supplied-sample-receipt.png'),
  });
  await page.locator('#receipt-done').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#stat-complete').textContent === '1',
  );
  assert.match(
    await page.locator('#phone-standings .rank-card').first().textContent(),
    /rizwanstriker.*1W · 0L · \+4 diff.*3/,
  );
  await page.locator('#phone-standings .rank-card').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#league .standings-layout')).opacity === '1');
  await page.screenshot({
    path: path.join(output, 'supplied-sample-standings.png'),
  });
  const endpoint = server.url + '/.netlify/functions/league?action=';
  const data = await (await page.request.get(endpoint + 'state')).json();
  const state = data.state || data;
  const rows = standings(state);
  assert.equal(rows.find((r) => r.id === 'rizwanstriker').points, 3);
  assert.equal(rows.find((r) => r.id === 'bowdownbro').losses, 1);
  assert.equal(leagueSummary(state).remaining, 20);
  assert.deepEqual(leagueSummary(state).champions, []);
  assert.equal(state.matches.length, 1);
  assert(state.matches[0].receiptId);
  const evidenceId = state.matches[0].evidenceId;
  assert.equal(
    (await page.request.get(endpoint + 'evidence&id=' + evidenceId)).status(),
    200,
  );
  await page
    .getByRole('button', { name: 'Queue a match', exact: true })
    .click();
  await page.locator('#schedule-form [name=a]').fill('bowdownbro');
  await page.locator('#schedule-form [name=b]').fill('rizwanstriker');
  await page.locator('#schedule-form button[type=submit]').click();
  await page.locator('#schedule-form .form-error:not([hidden])').waitFor();
  assert.match(
    await page.locator('#schedule-form .form-error').textContent(),
    /already.*Reverse/,
  );
  await page.locator('#modal-close').click();
  await page.waitForFunction(() => !history.state?.__soloSheet);

  // Use generated plain tones to test audio; no copyrighted song is bundled.
  const rate = 22050,
    seconds = 4,
    samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(
        Math.sin((2 * Math.PI * 110 * i) / rate) *
          4000 *
          (Math.floor(i / (rate / 2)) % 2 ? 0.15 : 1),
      ),
      44 + i * 2,
    );
  const audioPath = path.join(temp, 'local-audio-test.wav');
  await writeFile(audioPath, wav);
  await page.locator('#settings-open').click();
  await page.locator('#soundtrack-file').setInputFiles(audioPath);
  await page.waitForFunction(() =>
    document
      .querySelector('#soundtrack-status')
      .textContent.includes('Saved on this device'),
  );
  assert(
    await page.locator('#lobby-audio').evaluate((audio) => audio.paused),
  );
  assert.equal(await page.locator('#soundtrack-haptics').isChecked(), false);
  await page.locator('#soundtrack-haptics').check();
  await page.locator('#soundtrack-play').click();
  await page.waitForFunction(
    () =>
      !document.querySelector('#lobby-audio').paused &&
      document.querySelector('#lobby-audio').currentTime > 0.2,
  );
  await page.waitForFunction(() =>
    window.__beatPulses.some((pulse) => pulse.pattern === 7),
  );
  await page.locator('#soundtrack-haptics').uncheck();
  const pulseCount = await page.evaluate(
    () => window.__beatPulses.filter((p) => p.pattern === 7).length,
  );
  assert(
    await page
      .locator('#lobby-audio')
      .evaluate((audio) => audio.src.startsWith('blob:')),
  );
  await page.locator('#soundtrack-volume').fill('20');
  assert.equal(
    await page.evaluate(
      () => window.__beatPulses.filter((p) => p.pattern === 7).length,
    ),
    pulseCount,
  );
  assert.equal(
    await page.locator('#lobby-audio').evaluate((audio) => audio.volume),
    0.2,
  );
  await page.locator('#soundtrack-play').click();
  assert(
    await page.locator('#lobby-audio').evaluate((audio) => audio.paused),
  );
  await page.locator('#settings-close').click();
  await page.waitForFunction(() => !history.state?.__soloSheet);
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector('#soundtrack-name').textContent ===
      'local-audio-test.wav',
  );
  assert(
    await page.locator('#lobby-audio').evaluate((audio) => audio.paused),
    'Restored tracks never autoplay',
  );
  await page.locator('#settings-open').click();
  await page.locator('#soundtrack-remove').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#soundtrack-status')
      .textContent.includes('removed'),
  );
  await page.locator('#settings-close').click();
  await page.waitForFunction(() => !history.state?.__soloSheet);
  await page.reload();
  assert.equal(await page.locator('#lobby-audio').getAttribute('src'), null);
  console.log(
    'PASS: supplied screenshot → rizwanstriker 5–1 bowdownbro → 3 points, +4 diff, 20 remaining; receipt, evidence, reload and reverse duplicate rejection',
  );
  console.log(
    'PASS: local audio selection, explicit playback, volume, pause, restore without autoplay and removal',
  );
  await server.close();
  server = await startServer({ dataDir: temp, port: 5199, apiPort: 0 });
  const cleanContext = await browser.newContext();
  const cleanPage = await cleanContext.newPage();
  await cleanPage.goto(server.url);
  await cleanPage.waitForFunction(
    () => document.querySelector('#stat-complete').textContent === '1',
  );
  assert.match(
    await cleanPage.locator('#standings-body tr').first().textContent(),
    /rizwanstriker/,
  );
  assert.equal(
    await cleanPage.locator('#lobby-audio').getAttribute('src'),
    null,
    'Music is local, not shared',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: the actual sample result survives a server restart and a fresh browser; sample data is isolated',
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(temp, { recursive: true, force: true });
}

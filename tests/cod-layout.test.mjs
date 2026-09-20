import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { detectResultBands, readScoreGlyph } from '../server/cod-layout.mjs';

test('score glyphs require a confident, single allowed digit and disclose interpretation', () => {
  for (let score = 0; score <= 6; score++)
    assert.deepEqual(readScoreGlyph(String(score), 90), {
      score,
      interpreted: false,
    });
  assert.deepEqual(readScoreGlyph('b', 80), { score: 6, interpreted: true });
  for (const text of ['7', '10', '6 5', 'kills 5', ''])
    assert.equal(readScoreGlyph(text, 90).score, null);
  assert.equal(readScoreGlyph('6', 30).score, null);
});

test('layout detection locates both result bands across resolutions and rejects unrelated images', async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="550"><rect width="1200" height="550" fill="#222"/><rect x="0" y="260" width="1200" height="80" fill="#296bb7"/><rect x="0" y="390" width="1200" height="80" fill="#b34e46"/></svg>',
  );
  for (const width of [800, 1600]) {
    const image = await sharp(svg).resize({ width }).png().toBuffer();
    const found = await detectResultBands(image);
    assert(found);
    assert(Math.abs(found.blue[0] - 260 / 550) < 0.02);
    assert(Math.abs(found.red[0] - 390 / 550) < 0.02);
  }
  const blank = await sharp({
    create: { width: 1200, height: 550, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  assert.equal(await detectResultBands(blank), null);
});

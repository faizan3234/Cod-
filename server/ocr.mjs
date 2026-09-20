import { createWorker } from 'tesseract.js';
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import { parseScoreboard } from '../lib/extraction.js';
import { extractCODResult } from './cod-layout.mjs';
const require = createRequire(import.meta.url),
  langRoot = path.dirname(
    require.resolve('@tesseract.js-data/eng/package.json'),
  );
export async function extractScoreboard(bytes, players) {
  const input = sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'error' }),
    meta = await input.metadata();
  if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages || 1) !== 1)
    throw Error('Use a single PNG, JPG or WebP screenshot.');
  if (meta.width < 160 || meta.height < 100) throw Error('Image too small.');
  const image = await input
    .rotate()
    .resize({ width: 2400, height: 1800, fit: 'inside' })
    .flatten({ background: '#fff' })
    .normalise()
    .png()
    .toBuffer();
  const worker = await createWorker('eng', 1, {
    langPath: path.join(langRoot, '4.0.0'),
    cachePath: '/tmp',
    gzip: true,
    workerPath: require.resolve('tesseract.js/src/worker-script/node/index.js'),
    corePath:
      require.resolve('tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
  });
  try {
    const oriented = await sharp(bytes)
      .rotate()
      .flatten({ background: '#fff' })
      .png()
      .toBuffer();
    const result = await extractCODResult(worker, oriented, players);
    if (result)
      return {
        ...result,
        mime: { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[
          meta.format
        ],
      };
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    });
    const { data } = await worker.recognize(
      image,
      {},
      { text: true, blocks: true },
    );
    if (data.text.trim().length < 4)
      throw Error('No readable scoreboard text.');
    return {
      ...parseScoreboard(data.text, players, data.confidence),
      mime: { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[
        meta.format
      ],
    };
  } finally {
    await worker.terminate();
  }
}

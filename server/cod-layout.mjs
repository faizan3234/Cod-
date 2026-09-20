import sharp from 'sharp';
import { parseScoreboard } from '../lib/extraction.js';

// Detect the two coloured result bands, rather than assuming a screen resolution.
// Regions refer to this game's result layout. No score or winner is supplied here.
export async function detectResultBands(bytes) {
  const { data, info } = await sharp(bytes)
    .resize({ width: 480 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width / info.height < 1.6 || info.width / info.height > 2.6)
    return null;
  function bands(kind) {
    const runs = [];
    let start = null;
    for (let y = Math.floor(info.height * 0.4); y < info.height * 0.94; y++) {
      let count = 0,
        coloured = 0;
      for (
        let x = Math.floor(info.width * 0.14);
        x < info.width * 0.29;
        x += 4
      ) {
        const i = (y * info.width + x) * info.channels,
          r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (
          kind === 'blue' ? b - r > 25 && b - g > 12 : r - b > 25 && r - g > 20
        )
          coloured++;
        count++;
      }
      const found = coloured / count > 0.75;
      if (found && start === null) start = y;
      if (!found && start !== null) {
        runs.push([start / info.height, y / info.height]);
        start = null;
      }
    }
    return runs
      .filter(([a, b]) => b - a > 0.06 && b - a < 0.2)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
  }
  const blue = bands('blue')[0],
    red = bands('red').find((r) => blue && r[0] > blue[1]);
  return blue && red && red[0] - blue[1] > 0.03 && red[0] - blue[1] < 0.16
    ? { blue, red }
    : null;
}

// Single digits can resemble letters in the game's condensed typeface.
// This conversion is restricted to the isolated numeric score region and is disclosed.
export function readScoreGlyph(text, confidence) {
  const glyph = text.trim();
  if (confidence < 55 || glyph.length !== 1)
    return { score: null, interpreted: false };
  const substitutions = { b: '6', S: '5', I: '1', l: '1', O: '0', o: '0' };
  const digit = substitutions[glyph] || glyph;
  return {
    score: /^[0-6]$/.test(digit) ? Number(digit) : null,
    interpreted: glyph !== digit,
  };
}

function isolateDigit(mask, width, height) {
  const seen = new Uint8Array(mask.length),
    components = [];
  for (let k = 0; k < mask.length; k++) {
    if (mask[k] || seen[k]) continue;
    const stack = [k],
      points = [];
    let y0 = height,
      y1 = 0,
      x0 = width,
      x1 = 0;
    seen[k] = 1;
    while (stack.length) {
      const at = stack.pop(),
        x = at % width,
        y = Math.floor(at / width);
      points.push(at);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const n of [at - 1, at + 1, at - width, at + width])
        if (
          n >= 0 &&
          n < mask.length &&
          Math.abs((n % width) - x) <= 1 &&
          !seen[n] &&
          mask[n] === 0
        ) {
          seen[n] = 1;
          stack.push(n);
        }
    }
    if (y1 - y0 > height * 0.25) {
      if (x0 <= 1 || x1 >= width - 2 || x1 - x0 >= width * 0.85) return null;
      components.push({ points, height: y1 - y0 });
    }
  }
  components.sort((a, b) => b.height - a.height);
  // More than one digit-sized object is ambiguous; never silently discard a second digit.
  if (components.length !== 1) return null;
  const result = Buffer.alloc(mask.length, 255);
  for (const k of components[0].points) result[k] = 0;
  return result;
}

async function regionImage(bytes, meta, region, kind) {
  const [x, y, w, h] = region,
    crop = sharp(bytes).extract({
      left: Math.floor(x * meta.width),
      top: Math.floor(y * meta.height),
      width: Math.floor(w * meta.width),
      height: Math.floor(h * meta.height),
    });
  if (kind === 'original')
    return crop.resize({ height: 100 }).normalise().png().toBuffer();
  const { data, info } = await crop
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let mask = Buffer.alloc(info.width * info.height, 255);
  for (let k = 0; k < mask.length; k++) {
    const r = data[k * info.channels],
      g = data[k * info.channels + 1],
      b = data[k * info.channels + 2];
    const ink =
      kind === 'blue-name'
        ? g - Math.max(r, b) > 25
        : kind === 'red-name'
          ? Math.min(r, g, b) > 165
          : kind === 'blue-score'
            ? r > 85 && g > 140 && b > 175 && b - r > 25
            : r > 185 && g > 140 && b > 140 && r - Math.max(g, b) > 20;
    if (ink) mask[k] = 0;
  }
  if (kind.endsWith('score')) {
    mask = isolateDigit(mask, info.width, info.height);
    if (!mask) return null;
  }
  let image = sharp(mask, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .resize({ height: 160 })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#fff' });
  // Materialise each scale: Sharp applies only the final resize in one pipeline.
  if (kind.endsWith('score'))
    image = sharp(await image.png().toBuffer())
      .trim({ threshold: 20 })
      .resize({ height: 110 })
      .extend({ top: 15, bottom: 15, left: 15, right: 15, background: '#fff' });
  return image.png().toBuffer();
}

export async function extractCODResult(worker, bytes, players) {
  const bands = await detectResultBands(bytes);
  if (!bands) return null;
  const { blue, red } = bands,
    meta = await sharp(bytes).metadata(),
    readings = [],
    candidates = [],
    warnings = [];
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    tessedit_char_whitelist: '',
    user_defined_dpi: '300',
  });
  const recognise = async (image, label) => {
    if (!image) return { text: '', confidence: 0 };
    const { data } = await worker.recognize(image);
    readings.push({
      label,
      text: data.text.trim(),
      confidence: data.confidence,
    });
    return data;
  };
  for (const [index, band] of [blue, red].entries()) {
    const variants = [];
    for (const kind of ['original', index === 0 ? 'blue-name' : 'red-name']) {
      const nameRegion =
        kind === 'original'
          ? [
              0.486,
              band[0] + (band[1] - band[0]) * 0.42,
              0.223,
              (band[1] - band[0]) * 0.3,
            ]
          : [
              0.484,
              band[0] + (band[1] - band[0]) * 0.43,
              0.3,
              (band[1] - band[0]) * 0.36,
            ];
      const r = await recognise(
        await regionImage(bytes, meta, nameRegion, kind),
        `${index === 0 ? 'Blue' : 'Red'} player (${kind})`,
      );
      const parsed = parseScoreboard(
        r.text + '\n' + r.text.replace(/\s+/g, ''),
        players,
        r.confidence,
      ).candidates;
      for (const candidate of parsed)
        variants.push({ ...candidate, confidence: r.confidence });
    }
    variants.sort(
      (a, b) =>
        Number(!!b.playerId) - Number(!!a.playerId) ||
        Number(b.exact) - Number(a.exact) ||
        b.confidence - a.confidence,
    );
    const name = variants[0] || {
      detectedName: '',
      playerId: null,
      exact: false,
      confidence: 0,
    };
    const region = [
      index === 0 ? 0.4 : 0.56,
      blue[1],
      index === 0 ? 0.047 : 0.052,
      red[0] - blue[1],
    ];
    const r = await recognise(
      await regionImage(
        bytes,
        meta,
        region,
        index === 0 ? 'blue-score' : 'red-score',
      ),
      index === 0 ? 'Blue match score' : 'Red match score',
    );
    const score = readScoreGlyph(r.text, r.confidence);
    candidates.push({
      ...name,
      score: score.score,
      sourceLine: `${name.detectedName || 'Unread player'} · central match score: ${r.text.trim() || 'unread'}`,
      scoreInterpreted: score.interpreted,
    });
    if (score.interpreted)
      warnings.push(
        'A score character needed OCR interpretation. Compare it with the original digit.',
      );
  }
  if (candidates.some((c) => !c.playerId))
    warnings.push('Select the roster player for any unread name.');
  if (candidates.some((c) => !c.exact))
    warnings.push(
      'Confirm the suggested player identities against the screenshot.',
    );
  if (candidates.some((c) => c.score === null))
    warnings.push(
      'Enter any unread final match score from the centre score strip. Kill counts are not match scores.',
    );
  if (
    candidates[0].playerId &&
    candidates[0].playerId === candidates[1].playerId
  ) {
    candidates[1].playerId = null;
    warnings.push(
      'Two different players are required; check the name on each side.',
    );
  }
  const confidence = Math.round(
    readings.reduce((sum, r) => sum + r.confidence, 0) / readings.length,
  );
  if (confidence < 70)
    warnings.push(
      'This screenshot is difficult to read. Check every field before posting.',
    );
  return {
    layout: 'cod-result-bands',
    rawText: readings.map((r) => r.label + ': ' + r.text).join('\n'),
    confidence,
    candidates,
    map: '',
    warnings: [...new Set(warnings)],
  };
}

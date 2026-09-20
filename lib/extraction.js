import { normalizeName, resolveName } from './league.js';
export function parseScoreboard(text, players, confidence = 0) {
  const lines = String(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    candidates = [];
  for (const line of lines) {
    let p = players.find((p) =>
        normalizeName(line).includes(normalizeName(p.name)),
      ),
      name = p?.name || '';
    if (!name)
      for (const token of line.split(/\s+/)) {
        const r = resolveName(token, players);
        if (r.playerId) {
          p = players.find((p) => p.id === r.playerId);
          name = token;
          break;
        }
      }
    if (!name) {
      const m = line.match(/^([\p{L}][\p{L}\p{N}_.-]{2,31})\s+(\d+)\s*$/u);
      if (
        m &&
        !/^(score|round|team|kills|deaths|time|ping|level|rank|total)$/i.test(
          m[1],
        )
      )
        name = m[1];
    }
    if (
      !name ||
      candidates.some((c) =>
        p ? c.playerId === p.id : c.detectedName === name,
      )
    )
      continue;
    const at = line.toLowerCase().indexOf(name.toLowerCase()),
      tail =
        at >= 0
          ? line.slice(at + name.length)
          : line.replace(/[\p{L}\p{N}_.-]*[\p{L}][\p{L}\p{N}_.-]*/gu, ' '),
      nums = [...tail.matchAll(/(?:^|\s|:)(\d+)(?=\s|$)/g)].map((m) =>
        Number(m[1]),
      );
    candidates.push({
      detectedName: name,
      playerId: p?.id || null,
      exact: normalizeName(name) === normalizeName(p?.name || ''),
      score: nums.length === 1 && nums[0] <= 6 ? nums[0] : null,
      sourceLine: line,
    });
  }
  const rows = candidates.slice(0, 2),
    warnings = [];
  if (rows.length !== 2)
    warnings.push(
      'Select both roster players; two names were not clearly identified.',
    );
  if (candidates.length > 2)
    warnings.push(
      'More than two names found. Check this is a final 1v1 scoreboard.',
    );
  if (rows.length !== 2 || rows.some((r) => r.score === null))
    warnings.push(
      'Check the final match scores. Ambiguous numeric columns were not guessed.',
    );
  if (rows.some((r) => !r.exact))
    warnings.push(
      'Confirm different spellings against the correct roster players.',
    );
  if (confidence < 70)
    warnings.push('This image is difficult to read. Check every field.');
  return {
    rawText: String(text).slice(0, 8000),
    confidence: Math.round(confidence),
    candidates: rows,
    map: (lines.find((l) => /^map\s*:/i.test(l)) || '')
      .replace(/^map\s*:\s*/i, '')
      .slice(0, 40),
    warnings,
  };
}

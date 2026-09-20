export const INITIAL_NAMES = [
  'bowdownbro',
  'snowstorm',
  'fiercekhan',
  'rizwanstriker',
  'ahsankhan242',
  'codenamedeath',
  'silbuzzy',
];
export const REACTIONS = ['fire', 'clutch', 'gg'];
export const normalizeName = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
export function cleanName(value) {
  const name = String(value ?? '')
    .normalize('NFKC')
    .trim();
  if (
    name.length < 2 ||
    name.length > 32 ||
    !/^[\p{L}\p{N} _.-]+$/u.test(name) ||
    normalizeName(name).length < 2
  )
    throw Error(
      'Use 2–32 letters, numbers, spaces, dots, underscores or hyphens.',
    );
  return name;
}
export function initialState() {
  return {
    version: 1,
    players: INITIAL_NAMES.map((name) => ({ id: normalizeName(name), name })),
    matches: [],
    clips: [],
    updatedAt: null,
  };
}
export function pairKey(a, b) {
  if (!a || !b || a === b) throw Error('Choose two different players.');
  return [a, b].sort().join('~');
}
export function validateScores(a, b) {
  if (
    ![a, b].every(
      (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6,
    )
  )
    throw Error('Scores must be whole numbers from 0 to 6.');
  if (a === b)
    throw Error('A tie is not a final result. Upload the deciding result.');
}
export function fixtures(s) {
  const map = new Map(s.matches.map((m) => [m.id, m]));
  return s.players.flatMap((a, i) =>
    s.players.slice(i + 1).map((b) => {
      const id = pairKey(a.id, b.id);
      return (
        map.get(id) || { id, playerA: a.id, playerB: b.id, status: 'pending' }
      );
    }),
  );
}
export function standings(s) {
  const rows = s.players.map((p) => ({
      ...p,
      played: 0,
      wins: 0,
      losses: 0,
      for: 0,
      against: 0,
      diff: 0,
      points: 0,
      form: [],
      rank: null,
    })),
    byId = new Map(rows.map((r) => [r.id, r]));
  const done = s.matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  for (const m of done) {
    const a = byId.get(m.playerA),
      b = byId.get(m.playerB);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.for += m.scoreA;
    a.against += m.scoreB;
    b.for += m.scoreB;
    b.against += m.scoreA;
    const win = m.scoreA > m.scoreB ? a : b,
      lose = win === a ? b : a;
    win.wins++;
    win.points += 3;
    lose.losses++;
    win.form.push('W');
    lose.form.push('L');
  }
  rows.forEach((r) => (r.diff = r.for - r.against));
  rows.sort(
    (a, b) =>
      Number(a.played === 0) - Number(b.played === 0) ||
      b.points - a.points ||
      b.diff - a.diff ||
      b.for - a.for ||
      a.name.localeCompare(b.name),
  );
  const groups = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (
      last &&
      !!last[0].played === !!row.played &&
      last[0].points === row.points &&
      last[0].diff === row.diff &&
      last[0].for === row.for
    )
      last.push(row);
    else groups.push([row]);
  }
  let pos = 1;
  for (const group of groups) {
    const match =
      group.length === 2 &&
      done.find((m) => m.id === pairKey(group[0].id, group[1].id));
    if (match) {
      const id = match.scoreA > match.scoreB ? match.playerA : match.playerB;
      group.sort((a, b) => Number(b.id === id) - Number(a.id === id));
    }
    group.forEach((r, i) => (r.rank = r.played ? pos + (match ? i : 0) : null));
    pos += group.length;
  }
  return groups.flat();
}
export function leagueSummary(s) {
  const all = fixtures(s),
    done = all.filter((m) => m.status === 'completed'),
    rows = standings(s),
    ranked = rows.filter((r) => r.played),
    top = ranked.length ? Math.min(...ranked.map((r) => r.rank)) : null,
    leaders = ranked.filter((r) => r.rank === top),
    disputes = done.reduce((n, m) => n + (m.reports?.length || 0), 0),
    finished = all.length > 0 && done.length === all.length;
  return {
    total: all.length,
    completed: done.length,
    remaining: all.length - done.length,
    percent: all.length ? Math.round((done.length / all.length) * 100) : 0,
    leaders,
    disputes,
    finished,
    champions: finished && !disputes ? leaders : [],
    unplayed: rows.filter((r) => !r.played),
    rosterLocked: done.length > 0,
  };
}
export function remainingOpponents(s, id) {
  const complete = new Set(
    s.matches.filter((m) => m.status === 'completed').map((m) => m.id),
  );
  return s.players.filter(
    (p) => p.id !== id && !complete.has(pairKey(id, p.id)),
  );
}
export function reminder(s, id = '') {
  const names = Object.fromEntries(s.players.map((p) => [p.id, p.name])),
    left = fixtures(s).filter(
      (m) =>
        m.status !== 'completed' &&
        (!id || [m.playerA, m.playerB].includes(id)),
    ),
    none = leagueSummary(s).unplayed.map((p) => p.name);
  return [
    'COD SOLO LEAGUE — MATCH REMINDER',
    '',
    left.length ? 'Results still needed:' : 'All results posted.',
    ...left.map((m) => '• ' + names[m.playerA] + ' vs ' + names[m.playerB]),
    '',
    none.length
      ? 'No games posted: ' + none.join(', ')
      : 'Everyone has posted a result.',
    '',
    'One match per pair. Scores 0–6; no ties. Winner earns 3 points.',
    'Arrange a time with your opponent. Upload the final scoreboard and check both names and scores.',
  ].join('\n');
}
export function editDistance(a, b) {
  const r = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let p = r[0];
    r[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const v = r[j];
      r[j] = Math.min(
        r[j] + 1,
        r[j - 1] + 1,
        p + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      p = v;
    }
  }
  return r[b.length];
}
export function resolveName(input, players) {
  const n = normalizeName(input),
    exact = players.find((p) => normalizeName(p.name) === n);
  if (exact) return { playerId: exact.id, exact: true };
  if (n.length < 4) return { playerId: null, exact: false };
  const c = players
    .map((p) => ({ id: p.id, d: editDistance(n, normalizeName(p.name)) }))
    .sort((a, b) => a.d - b.d);
  return {
    playerId:
      c[0] &&
      c[0].d <= Math.max(1, Math.floor(n.length * 0.22)) &&
      c[0].d !== c[1]?.d
        ? c[0].id
        : null,
    exact: false,
  };
}

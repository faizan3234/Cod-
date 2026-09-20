import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState,
  fixtures,
  pairKey,
  normalizeName,
  validateScores,
  standings,
  leagueSummary,
  remainingOpponents,
  resolveName,
  reminder,
} from '../lib/league.js';
import { parseScoreboard } from '../lib/extraction.js';

function result(a, b, scoreA, scoreB) {
  return {
    id: pairKey(a, b),
    playerA: a,
    playerB: b,
    scoreA,
    scoreB,
    status: 'completed',
    completedAt: '2026-01-01T12:00:00.000Z',
    reports: [],
  };
}
test('the real roster starts with twenty-one unique unplayed pairs and no leader', () => {
  const state = initialState(),
    matches = fixtures(state),
    summary = leagueSummary(state);
  assert.equal(state.players.length, 7);
  assert.equal(matches.length, 21);
  assert.equal(new Set(matches.map((m) => m.id)).size, 21);
  assert.equal(summary.completed, 0);
  assert.deepEqual(summary.leaders, []);
  assert.deepEqual(summary.champions, []);
  assert(
    standings(state).every(
      (p) => p.rank === null && p.points === 0 && p.played === 0,
    ),
  );
});
test('canonical identities, reverse pairs and spelling suggestions', () => {
  assert.equal(normalizeName(' Fierce_Khan '), normalizeName('fiercekhan'));
  assert.equal(pairKey('a', 'b'), pairKey('b', 'a'));
  assert.throws(() => pairKey('a', 'a'));
  assert.deepEqual(resolveName('fierecekhan', initialState().players), {
    playerId: 'fiercekhan',
    exact: false,
  });
  assert.equal(
    resolveName('totallynewplayer', initialState().players).playerId,
    null,
  );
});
test('final scores require integers 0–6 and an actual winner', () => {
  for (const pair of [
    [7, 2],
    [-1, 0],
    [2.5, 1],
    [NaN, 1],
    ['6', 2],
    [null, 1],
    [6, 6],
  ])
    assert.throws(() => validateScores(...pair));
  validateScores(6, 0);
  validateScores(1, 0);
  validateScores(3, 6);
});
test('standings and reminders derive only from completed matches', () => {
  const state = initialState();
  state.matches.push(result('snowstorm', 'bowdownbro', 4, 6), {
    id: pairKey('fiercekhan', 'rizwanstriker'),
    playerA: 'fiercekhan',
    playerB: 'rizwanstriker',
    status: 'queued',
  });
  const [leader] = standings(state),
    summary = leagueSummary(state);
  assert.equal(leader.id, 'bowdownbro');
  assert.equal(leader.points, 3);
  assert.equal(leader.diff, 2);
  assert.equal(leader.played, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.remaining, 20);
  assert.equal(summary.unplayed.length, 5);
  assert.equal(summary.champions.length, 0);
  assert.equal(remainingOpponents(state, 'bowdownbro').length, 5);
  assert(
    !remainingOpponents(state, 'bowdownbro').some((p) => p.id === 'snowstorm'),
  );
  assert(!reminder(state, 'bowdownbro').includes('bowdownbro vs snowstorm'));
  assert(reminder(state).includes('fiercekhan vs rizwanstriker'));
});
test('the crown waits for all results and no outstanding concerns', () => {
  const state = initialState();
  state.matches = fixtures(state).map((m) =>
    result(m.playerA, m.playerB, 6, 2),
  );
  assert.equal(leagueSummary(state).champions[0].id, 'bowdownbro');
  state.matches[0].reports.push({ reason: 'Synthetic test concern' });
  assert.equal(leagueSummary(state).champions.length, 0);
});
test('genuinely equal three-way records share the final crown', () => {
  const state = initialState();
  state.players = state.players.slice(0, 3);
  const [a, b, c] = state.players.map((p) => p.id);
  state.matches = [result(a, b, 6, 4), result(b, c, 6, 4), result(c, a, 6, 4)];
  assert(standings(state).every((p) => p.rank === 1));
  assert.equal(leagueSummary(state).champions.length, 3);
});
test('OCR parses clear rows and leaves ambiguous columns for review', () => {
  const players = initialState().players;
  const clear = parseScoreboard(
    'SYNTHETIC TEST\nbowdownbro 6\nsnowstorm 4\nMap: Test map',
    players,
    94,
  );
  assert.deepEqual(
    clear.candidates.map((c) => [c.playerId, c.score]),
    [
      ['bowdownbro', 6],
      ['snowstorm', 4],
    ],
  );
  assert.equal(clear.map, 'Test map');
  const messy = parseScoreboard(
    'bowdownbro 6 18 9\nsnowstorm 4 10 12',
    players,
    50,
  );
  assert(messy.candidates.every((c) => c.score === null));
  assert(messy.warnings.length >= 2);
  const alias = parseScoreboard('fierecekhan 6\nahsankhan242 3', players, 88);
  assert.equal(alias.candidates[0].playerId, 'fiercekhan');
  assert.equal(alias.candidates[1].score, 3);
  assert.equal(alias.candidates[0].exact, false);
});

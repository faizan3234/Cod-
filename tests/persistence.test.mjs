import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createService } from '../server/service.mjs';
import { fileStore } from '../server/local-store.mjs';

test('a saved result survives a new server instance, cookie-free reads and retries', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'league-persistence-'));
  const extract = async () => ({
    rawText: 'SYNTHETIC PERSISTENCE TEST',
    mime: 'image/png',
    confidence: 99,
    candidates: [
      { playerId: 'bowdownbro', score: 6 },
      { playerId: 'snowstorm', score: 4 },
    ],
    warnings: [],
  });
  const start = () => createService({ store: fileStore(directory), extract });
  const client = (handler, token) => (action, body) =>
    handler(
      new Request(
        'https://test.local/.netlify/functions/league?action=' + action,
        {
          method: body ? 'POST' : 'GET',
          headers: {
            ...(token ? { cookie: 'solo_visitor=' + token } : {}),
            ...(body
              ? {
                  'X-League-Client': 'web',
                  ...(!(body instanceof FormData)
                    ? { 'Content-Type': 'application/json' }
                    : {}),
                }
              : {}),
          },
          ...(body
            ? { body: body instanceof FormData ? body : JSON.stringify(body) }
            : {}),
        },
      ),
    );
  try {
    const first = client(start(), 'a'.repeat(64));
    const form = new FormData();
    form.append(
      'screenshot',
      new Blob(['SYNTHETIC TEST ONLY'], { type: 'image/png' }),
      'test.png',
    );
    const draft = await (await first('extract', form)).json();
    const payload = {
      playerA: 'bowdownbro',
      playerB: 'snowstorm',
      scoreA: 6,
      scoreB: 4,
      evidenceId: draft.id,
      receipt: draft.receipt,
      attested: true,
      submissionId: randomUUID(),
    };
    const saved = await first('result', payload);
    assert.equal(saved.status, 201);
    const receipt = await saved.json();
    assert(receipt.savedAt);
    assert.match(receipt.receiptId, /^[0-9a-f-]{36}$/);
    const restarted = client(start(), 'a'.repeat(64));
    const retry = await restarted('result', payload);
    assert.equal(retry.status, 200);
    const repeated = await retry.json();
    assert.equal(repeated.matchId, receipt.matchId);
    assert.equal(repeated.receiptId, receipt.receiptId);
    const freshBrowser = client(start());
    const state = await (await freshBrowser('state')).json();
    assert.equal(state.matches.length, 1);
    assert.equal(state.matches[0].scoreA, 6);
    assert.equal(state.matches[0].submissionKey, undefined);
    assert.equal(state.matches[0].submissionDigest, undefined);
    assert.equal(
      (
        await restarted('result', {
          ...payload,
          scoreA: 5,
          correctionNote: 'Different test score',
        })
      ).status,
      409,
    );
    const anotherSave = { ...payload, submissionId: randomUUID() };
    assert.equal((await restarted('result', anotherSave)).status, 409);
    const errorStore = {
      read: async () => {
        throw Error('Simulated storage outage');
      },
    };
    const failed = await client(createService({ store: errorStore, extract }))(
      'state',
    );
    assert.equal(failed.status, 503);
    const after = await (await freshBrowser('state')).json();
    assert.equal(after.matches.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

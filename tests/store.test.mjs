import test from 'node:test';
import assert from 'node:assert/strict';
import { storeName } from '../server/store.mjs';

test('runtime deployment context isolates previews and preserves production', () => {
  const production = storeName({
    deploy: { context: 'production', id: 'one' },
  });
  assert.equal(
    production,
    storeName({ deploy: { context: 'production', id: 'two' } }),
  );
  assert.notEqual(
    production,
    storeName({ deploy: { context: 'deploy-preview', id: 'one' } }),
  );
  assert.notEqual(
    storeName({ deploy: { context: 'deploy-preview', id: 'one' } }),
    storeName({ deploy: { context: 'branch-deploy', id: 'one' } }),
  );
  assert.throws(() => storeName({}));
  assert.throws(() => storeName({ deploy: { context: 'deploy-preview' } }));
});

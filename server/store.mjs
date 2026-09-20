import { getStore } from '@netlify/blobs';

// Build-only environment variables are not reliable inside Functions.
// Never default a preview to production when deployment context is absent.
export function storeName(context) {
  const deploy = context?.deploy;
  if (!deploy?.context) throw Error('Missing Netlify deployment context.');
  if (deploy.context === 'production') return 'solo-league-v2-production';
  if (!deploy.id) throw Error('Missing preview deployment identifier.');
  return ('solo-league-v2-' + deploy.context + '-' + deploy.id)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 120);
}

export function netlifyStore(context) {
  const store = getStore({ name: storeName(context), consistency: 'strong' });
  return {
    read: (key) =>
      store.getWithMetadata(key, { type: 'json', consistency: 'strong' }),
    write: async (key, value, etag) => {
      const result = await store.setJSON(
        key,
        value,
        etag ? { onlyIfMatch: etag } : { onlyIfNew: true },
      );
      if (result.modified && !result.etag)
        throw Error('Storage did not confirm the write.');
      return result.modified;
    },
    putBytes: async (key, bytes) => {
      await store.set(key, bytes);
    },
    bytes: (key) =>
      store.get(key, { type: 'arrayBuffer', consistency: 'strong' }),
    remove: (key) => store.delete(key),
  };
}

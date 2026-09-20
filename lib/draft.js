// A private, local draft only. Shared results always come from the server.
let database,
  queue = Promise.resolve();
function open() {
  return (database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('solo-league-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
function operation(kind, value) {
  const run = queue.then(async () => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
          'drafts',
          kind === 'read' ? 'readonly' : 'readwrite',
        ),
        store = tx.objectStore('drafts');
      const req =
        kind === 'read'
          ? store.get('result')
          : kind === 'clear'
            ? store.delete('result')
            : store.put(value, 'result');
      tx.oncomplete = () => resolve(kind === 'read' ? req.result : true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
  queue = run.catch(() => {});
  return run;
}
export const readDraft = () => operation('read').catch(() => null);
export const writeDraft = (value) =>
  operation('write', value).catch(() => false);
export const clearDraft = () => operation('clear').catch(() => false);

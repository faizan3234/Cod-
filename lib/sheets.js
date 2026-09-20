// Native dialog focus management, with one browser Back entry per open sheet.
let active = null,
  pending = null,
  finishClose;
const marker = '__soloSheet';
function clearMarker() {
  const next = { ...(history.state || {}) };
  delete next[marker];
  history.replaceState(next, '');
}
if (history.state?.[marker]) clearMarker();
export function showSheet(dialog) {
  if (dialog.open) return;
  if (pending) {
    void pending.then(() => showSheet(dialog));
    return;
  }
  if (active && active.dialog !== dialog) active.dialog.close();
  if (!history.state?.[marker])
    history.pushState({ ...history.state, [marker]: true }, '');
  active = { dialog, url: location.href };
  dialog.showModal();
}
export function hideSheet(dialog) {
  if (!dialog.open) return pending || Promise.resolve();
  if (dialog.querySelector('[aria-busy="true"]')) return Promise.resolve();
  const ownsEntry =
    active?.dialog === dialog &&
    active.url === location.href &&
    history.state?.[marker];
  dialog.close();
  active = null;
  if (ownsEntry) {
    pending = new Promise((resolve) => {
      finishClose = resolve;
    });
    history.back();
    return pending;
  }
  if (history.state?.[marker]) clearMarker();
  return Promise.resolve();
}
window.addEventListener('popstate', () => {
  if (active) {
    if (active.dialog.querySelector('[aria-busy="true"]')) {
      history.pushState({ ...history.state, [marker]: true }, '');
      return;
    }
    active.dialog.close();
    active = null;
  }
  if (history.state?.[marker]) clearMarker();
  const finish = finishClose;
  pending = null;
  finishClose = null;
  finish?.();
});

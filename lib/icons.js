const paths = {
  'chevron-down': 'm6 9 6 6 6-6',
  grip: 'M8 8h.01M16 8h.01M8 16h.01M16 16h.01',
  zap: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',

  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  trophy:
    'M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v6m-4 0h8',
  target:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v4m0 14v4M1 12h4m14 0h4',
  film: 'M3 3h18v18H3V3Zm4 0v18M17 3v18M3 8h4m10 0h4M3 16h4m10 0h4M10 8l5 4-5 4V8Z',
  lock: 'M5 11h14v10H5V11Zm3 0V7a4 4 0 0 1 8 0v4m-4 4v2',

  home: 'm3 10 9-7 9 7v11h-6v-7H9v7H3V10Z',
  matches: 'M5 4h14v16H5V4Zm4 5h6m-6 6h6M2 8h3m-3 8h3m14-8h3m-3 8h3',
  chart: 'M4 20V10h4v10M10 20V4h4v16m2 0V8h4v12',
  'arrow-up-right': 'M5 19 19 5M5 5h14v14',
  'arrow-down': 'M12 4v16m-7-7 7 7 7-7',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  scan: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 8h10M7 12h10M7 16h6',
  copy: 'M8 8h13v13H8V8ZM16 8V3H3v13h5',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2',
  play: 'm8 4 12 8-12 8V4Z',
  pause: 'M8 4v16M16 4v16',
  scroll: 'm7 5 5-3 5 3M12 2v6m-5 11 5 3 5-3M12 16v6M9 10h6v4H9Z',
  'volume-on':
    'M11 4 6 8H3v8h3l5 4V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  'volume-off': 'M11 4 6 8H3v8h3l5 4V4Zm5 5 5 6m-5 0 5-6',
  crown: 'm3 6 5 5 4-7 4 7 5-5-2 13H5L3 6Zm2 10h14',
  check: 'm5 12 4 4L19 6',
  motion: 'M3 7h10M3 12h6M3 17h10m2-13 6 8-6 8',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  fire: 'M13 3c1 5 6 6 6 12a7 7 0 0 1-14 0c0-3 1-5 3-7 0 4 2 4 2 4s4-4 3-9Z',
  clutch: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z',
  gg: 'M8 10V5a3 3 0 0 1 3-3v6h7a3 3 0 0 1 3 4l-2 8H8M3 9h5v12H3V9Z',
  flag: 'M5 22V3c5-4 9 4 14 0v10c-5 4-9-4-14 0',
  image: 'M3 3h18v18H3V3Zm0 14 6-6 4 4 3-3 5 5M16 7h.01',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.plus}"/></svg>`;
}
export function hydrateIcons(root = document) {
  root
    .querySelectorAll('[data-icon]')
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}

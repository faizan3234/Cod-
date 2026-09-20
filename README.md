# COD Solo League

A phone-first community 1v1 league with an atmospheric lobby, light standings and forms, shared match results, scoreboard OCR, gameplay uploads, reactions and an optional scroll-driven arena. No admin account or result password.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The local server runs the same upload and match-validation service as production. Local results live in `.local-data/`, which is ignored by Git. The UI labels this as **Local preview**. No sample results are loaded.

```sh
npm test
npm run build
```

## Deploy on Netlify

Import this GitHub repository into a Netlify project. The included `netlify.toml` sets the build command to `npm run build`, the publish directory to `dist`, the Functions directory to `netlify/functions`, and Node.js to 22. Netlify Blobs supplies shared persistent storage through the function's built-in credentials; there is no client-side API key or external OCR account to configure. Deploy through the connected repository so that both the function and the website are built. Uploading only `dist` to a static host does not run the backend.

For the requested `faizan3234/Cod-` repository, upload the **contents** of this folder to the repository root, then connect it to Netlify. If retaining an existing season, keep the same Netlify site when changing its connected repository; a different site has separate storage. This release does not modify the server, standings rules or production store name.

After deployment, check that the connection line says **Connected to the league**, the seven initial players appear, and a new season has zero posted results. Existing production results must remain after redeployment; do not change the production store name to reset a connection error. Use a separate deploy preview for upload testing, not the live season. Function and storage usage count toward your Netlify account's limits.

OCR language data, the worker and WebAssembly files are packaged with the function. The browser does not fetch a third-party OCR CDN. Fonts are also bundled locally. The site does not send screenshots to an AI service.

## How the season works

- Initial participants: bowdownbro, snowstorm, fiercekhan, rizwanstriker, ahsankhan242, codenamedeath and silbuzzy. These are roster names, not fabricated performances.
- The seven participants produce 21 unique pairings. Queuing a pair is optional; a final scoreboard can be posted directly.
- Names are normalized for capitalization, spaces and punctuation. OCR offers close spelling matches for review; it does not create new identities from a screenshot. Add real participants before the first result. The roster then locks.
- Each pair has one official result, regardless of ordering. The server uses conditional writes against a strongly consistent shared record so concurrent submissions cannot record a reversed duplicate.
- Scores must be whole numbers from 0 to 6 and cannot tie. A win earns three points. Tiebreakers: score difference, scores for, then head-to-head when exactly two players remain tied. Otherwise the rank is shared, including the final crown.
- Pending and queued matches contribute no points. Unplayed participants stay unranked. A final crown requires all pairs to finish and no open concerns.
- Reminders and remaining-opponent lists are computed from results. Copying a reminder does not automatically message anyone.
- Results refresh across browsers every 5 seconds while the page is visible, and immediately after an upload or reaction. A failed connection leaves a visible stale-data notice; it never invents fallback standings.

## Scoreboard uploads and fairness

Upload a PNG, JPG or WebP up to 4 MB. The server validates and decodes the image, normalizes it, runs English Tesseract OCR and extracts conservative suggestions. For the supported blue/red result-panel layout, it reads names from each panel and match scores from the central strip, separately from kill counts. Other layouts use conservative row parsing. Unread names and ambiguous numeric columns stay blank for manual review. A few isolated digit-shaped letters can be interpreted only inside the numeric crop, with a visible warning; OCR is never proof of a result. The uploader checks names and final scores, explains corrections and confirms that the image is an actual unedited final scoreboard. A one-hour receipt ties the review to the uploading browser. The original evidence and correction notes remain publicly viewable after submission. Exact duplicate images and duplicate player pairs are rejected. Posted results cannot be overwritten through the public API. A confirmed save opens a receipt with the score, time and original evidence. A dropped response can be retried with the same submission ID without adding a second record; using that ID with changed details is rejected.

Open upload does **not** establish player identity or prove image authenticity. OCR confidence measures text recognition, not trust. Screenshots can be altered and anonymous users can submit misleading data. The implementation prevents duplicate records and score-rule violations; it does not claim cheat-proof verification. Anyone can report a specific concern against the visible evidence, which makes standings provisional and holds the crown. Only the reporting browser can withdraw its own report. There is deliberately no password, admin approval flow, public reset or public result editor.

## Phone experience and optional match charter

The phone layout has a persistent thumb navigation bar, a central Post action, safe-area spacing, readable form controls, bottom-sheet dialogs, vertical standings cards with player-detail sheets and a followed-player view of remaining opponents. Home previews the top three participants only after real results exist. Match details and filters have their own sheets. The HOME / LEAGUE / POST / MATCHES / CLIPS tabs use hash routes; browser Back closes an open sheet before leaving the current route. The compact header shows LIVE, SYNCING, OFFLINE or UPDATED. Visible sync status distinguishes up-to-date records from a lost connection. Reduced motion is supported, and the expanded cinematic is optional on phones.

Settings has real Sound, Haptics and Motion switches. UI sound is off by default and requires a user gesture. Only result-saved, charter-locked and error cues exist; charter-locked is reserved and never played by the disabled charter. Haptics acknowledge meaningful events such as a confirmed save, copy, reaction or preference change, never navigation or scrolling. Haptics use the browser Vibration API when available; unsupported browsers show this clearly. Hardware, browser and system settings determine whether a physical vibration occurs.

The lobby uses an original vector environment, CSS perspective, a floating league emblem, a soft light beam and a small number of embers. Pointer/touch position and scrolling shift the scene with transforms. There is no WebGL dependency, device-motion permission or scroll hijacking. Effects pause off-screen and when the page is hidden; reduced-motion mode removes decorative animation. The supplied arena video remains available in full-screen mode with Skip and exit controls.

### Personal soundtrack

Open **Settings → Your soundtrack → Choose audio**, select an audio file you are allowed to use, then tap **Play music**. It stays in IndexedDB on that device; it is not uploaded or shared. MP3, M4A, WAV, OGG and FLAC are accepted up to 20 MB, subject to browser codec support. Playback never starts automatically on load or after restoring a track. Pause, volume and Remove controls are included. Playing a video pauses music, and switching away from the page stops music.

**Beat haptics** is a separate opt-in control. It uses measured bass energy, respects the main Haptics and Motion preferences, and limits pulses to 7 ms at least 700 ms apart. It is unavailable where the Vibration API or Web Audio is missing. The small lighting response works without vibration. Physical iPhone or Android vibration and audio latency must be checked on the device; the tests verify browser behavior, not hardware sensation.

The Dhurandhar recording is **not included**: no licensed audio file was supplied. The picker is ready for a permitted copy. The existing arena video's original audio is preserved.

Posting uses Choose → Review → Confirm → Receipt. The separate confirmation screen shows the final score, original evidence and required attestation. The save is confirmed by the server and includes a stable receipt ID. Match details can reopen the saved receipt later. An IndexedDB draft retains the screenshot, extracted fields and submission ID across refreshes on the same device. Review confirmation is required again after restoring. Drafts never submit automatically and are removed after a confirmed save; clearing browser data removes unfinished local drafts, not shared results. Offline writes are blocked. This final mobile polish does not change the existing server or persistence layer.

The manifest and Apple home-screen icon support installation on compatible browsers. The service worker supplies an honest offline page only; shared API responses and upload requests are never cached or replayed.

The match charter has a visible, disabled ivory-and-gold preview: see [the agreement options](docs/match-charter-proposal.md). Preventing somebody from accepting both sides needs two distinct verified accounts bound to the roster once. Typed names, signatures and cookies cannot establish player identity. No login or charter restriction has been enabled.

## Gameplay and the supplied arena video

The supplied intro is `public/arena.mp4`; its original audio is preserved. It loads near the arena section. Phones show a compact player after the league sections so a long animation does not stand between the user and their result. **Enter the arena** or **Scroll through** enables an edge-to-edge, full-screen scroll-controlled arena with the header and bottom tabs hidden, sequential text overlays, a progress indicator and always-visible Skip and exit controls; desktop scrolls through the video by default. **Play with sound** starts normal playback from a user gesture, as required by mobile browsers. Scrolling returns to silent scrubbing. The compact player retains the full video. Immersive mode crops it to cover the portrait or landscape viewport, using a configurable focal position. Reduced-motion preferences disable automatic scrubbing and decorative motion; playback remains available on demand.

Players can post MP4 or WebM gameplay up to 20 MB. The client uploads 2 MB chunks. The server verifies immutable chunks and the whole-file SHA-256 before publishing, and serves byte ranges for native playback. There is a 100-clip season cap. File validation checks format signatures and integrity, not content moderation or video transcoding; use a codec your audience's browsers can play, such as H.264/AAC MP4.

Fire, Clutch and GG reactions are public totals. An anonymous HttpOnly cookie provides one current choice per browser, which can be changed or removed. It is not account authentication and can be bypassed by clearing browser state; reactions have no effect on standings.

## Architecture and operations

- `app.js`, `styles.css`, `mobile.css`, `immersive.css`, `lib/mobile.js`, `index.html`: Vite frontend. Only sound, haptics, motion and followed-player preferences use localStorage; league records are stored by the backend. Following a player is not authentication.
- `lib/feedback.js`, `lib/draft.js`, `lib/sheets.js`: optional device feedback/settings, local unfinished-scoreboard recovery and dialog navigation history.
- `lib/lobby.js`, `public/lobby.svg`, `lib/soundtrack.js`: original layered lobby scene and private local music playback.
- `lib/league.js`: shared standings, schedule, identity and score logic.
- `lib/extraction.js`, `server/ocr.mjs`, `server/cod-layout.mjs`: OCR parsing, result-panel detection and image recognition.
- `server/service.mjs`: bounded uploads, per-IP/browser request limits, same-origin write checks, receipts, conditional match writes and media APIs.
- `server/store.mjs`: production Netlify Blobs adapter, with preview storage isolated from production.
- `server/local-store.mjs`, `scripts/server.mjs`: persistent local development backend.

Original upload evidence, clip files and league data are public through the application. Browser identifiers are hashed before storage and are not exposed in state responses. The API rejects oversized requests and requires the app's same-origin write header. This reduces routine misuse but is not authenticated abuse prevention. Abandoned drafts and incomplete chunks currently remain in storage; maintain retention and usage in the Netlify account if this grows beyond a small community season. Keep backups before changing stored season data. There is no automatic migration from older browser-only saved data.

## Tests

`npm test` covers empty standings, reverse-pair uniqueness, strict scores, real-result ranking, shared crowns, conservative OCR parsing, concurrent submissions, receipt ownership, evidence visibility, roster locking, report ownership, chunk integrity, range reads, reactions, result-panel detection and saved results surviving a server restart, a cookie-free read and a retry.

For the browser integration test:

```sh
npx playwright install chromium
npm run test:browser
npm run test:sample
```

The browser test starts isolated local servers and a temporary data directory, generates an explicitly labeled synthetic scoreboard for actual OCR, and tests confirmation and receipts, draft recovery after reload, offline write prevention, a server-saved result whose first response is dropped, settings, sheet and hash Back navigation, match filters, PWA icons and offline fallback, full-screen chrome hiding and Skip, second-browser sync, and video playback/upload/reactions. Viewports: 320×568, 360×800, 375×812, 390×844, 393×852, 412×915, 430×932, 844×390 and 932×430. A reduced-height focused-input check approximates keyboard space. Test-only API instrumentation verifies meaningful haptic calls, no navigation vibration and gesture-gated audio; it cannot verify physical vibration. These are Chromium viewport checks, not certification on physical iOS/Android devices or a measured 60 fps guarantee. Test data never enters production or the default local season. Screenshots go to ignored `test-results/`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if using an already installed Chromium.

The additional sample test uploads the supplied `tests/fixtures/cod-result-zoo.jpeg` through the actual browser and OCR service. It checks **rizwanstriker 5–1 bowdownbro**, a review warning for the blurry first name, explicit posting, three winner points, +4 difference, 20 remaining matchups, no premature crown, receipt and public evidence, reversed-pair rejection, reload and server-restart persistence in a fresh browser. The optional map stays manual. It also checks local audio selection, playback, volume, pause, reload without autoplay and removal using a generated test tone.

This is a community fan project, not affiliated with Activision. The lobby illustration is an original vector graphic. All match records start empty. The screenshot fixture is used only in isolated tests; no demo scoreboard or mock winner is seeded into the app.

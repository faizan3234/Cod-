# Match Charter — proposal, not an enabled feature

Use an ivory card, a thin muted-gold border, a small crown, the two roster names and two clear acceptance states. No drawn signature, name typing, PDF or repeated password prompt.

## Recommended experience

1. Each participant signs in once with a verified account. The organiser links that account to the correct roster player once. Public display names do not establish ownership.
2. Before a match, the participant sees one card and one **I agree — ready to play** button for their own slot. The opponent's slot only shows its status.
3. The server records the player ID, account ID, match ID, rule version and acceptance time. Two distinct roster-bound accounts must accept the same version. Anyone else is read-only.
4. Either participant uploads the final scoreboard and reviews the extracted details. The server accepts one final record for that pairing and derives the winner from the scores. A missing after-game approval cannot withhold a valid posted result.

Suggested rule text to review:

> One official match. No rematch. We check our connection and device before starting. Once play begins, lag, disconnections and device issues do not entitle either player to a replay. The completed final scoreboard will be posted and the result is final. Scores and identities must match the original evidence.

The disconnect case still needs a clear league decision: if the game ends without a final scoreboard, choose a forfeit/reporting rule before enabling this charter. Do not invent a 6–0 result or infer a forfeit from an absent screenshot. A final result rule must not prevent reporting forged evidence or an OCR/transcription error.

## Options

| Option                                        | Player effort                          | What it establishes                                                                                         |
| --------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Roster-bound sign-in, then one-tap acceptance | One initial sign-in; one tap per match | The same verified account cannot accept both slots; unassigned accounts cannot post or accept. Recommended. |
| Separate private player links                 | Open an individual link, then tap      | Possession of the link, not the person's identity. A forwarded or stolen link can be used by someone else.  |
| No charter                                    | Current screenshot review only         | Lowest friction; no claim that an upload was made by either named participant.                              |

An account system cannot stop deliberate account sharing or prove who physically played. Cookies, device checks, IP checks, typed names and decorative signature marks cannot solve this. Blocking two users with the same IP would also block genuine opponents on the same Wi-Fi.

This is a league-rules acknowledgement proposal. No legal enforceability is asserted. The site shows a clearly disabled preview card; signing and identity checks are not enabled; public uploads remain available while the idea is being considered.

If selected, implementation needs a sign-in provider configuration and a trusted one-time roster mapping. Google accounts must be verified on the server using their signed ID token and stable `sub` identifier, not a browser-supplied name or email: [Google's verification documentation](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

# Comment Picker

Checks every comment on your Instagram post or reel against the guidelines you set, then draws winners in a way anyone can verify. It was built for Kerala Blasters "Predict & Win" contests.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: token + Anthropic key
npm run dev                  # http://127.0.0.1:3000
```

1. **Settings**: paste your Instagram long-lived token and click **Test connection**. The settings page explains how to get a token.
2. **New contest**: paste the post or reel URL. The post must be on the connected account.
3. **Comments & followers**: click **Fetch all comments** and upload the followers export.
4. **Guidelines**: turn rules on or off and fill them in. For example: deadline, must follow, tag 2 friends, hashtags, score prediction or scorer. Then click **Save & check all entries**.
5. **Entries**: go through the **Needs review** list and approve or reject each one. Every decision is logged.
6. **Draw winners**: choose the number of winners and backups, then **Lock entries**. Post the two fingerprints (for example in a story), then click **Draw**.

## How accuracy is achieved

| Guideline | Source | Notes |
|---|---|---|
| Comments, replies, timestamps | Official Instagram Graph API | Every page is fetched. Rate limits and errors are retried. You can resume after a crash. Deleted comments are detected on re-fetch. The fetched count is compared with Instagram's own count. |
| Must follow | Instagram's *Download your information* followers export | The API cannot list followers. This export is the only accurate source. Request it **after** the deadline. |
| Tag N friends | Comment text | Each friend counts once. Tagging yourself, the host account or excluded accounts doesn't count. |
| Score prediction | Rule-based parser | Handles `2-1`, `2:1`, `2️⃣-1️⃣`, `൨-൧`, `KBFC 2-1 BFC`, `BFC 1-2 KBFC`, `two nil`, `randu-onnu` and `രണ്ട് - ഒന്ന്`. Times like `7:30 pm` and dates are ignored. |
| Correct answer (scorer, etc.) | Whole-word match on your aliases | Close misspellings go to **review**. They are never auto-accepted. "Noah or Luna" is caught as a hedged answer. |

Anything the app can't decide with certainty goes to **Needs review**. It is never guessed. Items in review are left out of the draw until you approve them.

The optional AI fallback (set `ANTHROPIC_API_KEY`) only *reads* unclear predictions. The rule still decides pass or fail, and anything the AI isn't confident about stays in review.

**Can't be verified by any tool:** "liked the post" and "shared to story". Instagram doesn't expose that data.

## Fair draw

Locking an entry saves a SHA-256 fingerprint of the eligible list and of a secret random seed. Drawing shuffles the list with HMAC-SHA256 and the seed, then reveals the seed. Anyone can re-run it:

```bash
node scripts/verify-draw.mjs <seed> pool.txt <winners> [backups]
```

Download `pool.txt` from the Draw tab. If the eligible list changes after locking (for example after a re-check or an override), the draw refuses to run.

## Notes

- Everything is stored locally in `~/.comment-picker/picker.db`, including the token. The server listens on 127.0.0.1 only.
- Keep the app running while a fetch is in progress. A 10k-comment post takes a few minutes, depending on Instagram's rate limits.
- Refresh the token at least once every 60 days (Settings → Refresh token).
- `npm test` runs the parser, rules engine, followers-import and draw tests.

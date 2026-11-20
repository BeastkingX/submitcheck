# PROGRESS

_Last updated: 2026-11-20 (Step 1: minimal shell scaffolded and verified locally)_

## Done
- `SPEC.md` — full kickoff spec, pasted verbatim (curly quotes and em dashes preserved).
- `.gitignore` — created **before the first commit**: `.env`, `.env.*`, `.vercel/`, dependencies, build output, caches, logs, OS/editor files.
- **Step 1: minimal Next.js shell.**
  - Next.js 16.4.6 (App Router) + TypeScript + React 19, scaffolded by hand in the existing repo; kickoff files and ignore rules untouched.
  - `src/app/page.tsx` — shows the title **SubmitCheck**, a "not ready" status line, the exact limitations note (“This checks the text you paste. It does not verify links work or guarantee eligibility.”), and a one-line note that `POST /api/agent` exists.
  - `src/app/api/agent/route.ts` — `POST` returns **HTTP 503** with `{"error":"Live review is not ready yet."}`. No fake analysis.
  - `npm run build` passes; `tsc --noEmit` passes.
  - **Verified locally** on a production build (`next start`): page `200` with title + note, endpoint `503` with the exact JSON body.

## Next
1. **Deploy this shell to Vercel Hobby** → capture the production URL, then re-run the curl check against it. (Blocked on GitHub/Vercel access — see below.)
2. Then: live review (one server-side Gemini free-tier call, timeout, no retries; `GEMINI_API_KEY` only as a Vercel env var).
3. Server-side validation: 10,000-char caps, `400` on invalid input, exact-substring evidence check (`met` → draft only; otherwise rules or draft), invented quote → `quote: null` + `unclear` + reason `The quoted evidence could not be found in the pasted text.`, `met` without quote → `unclear`.
4. UI: two textareas, **Check submission** button, loading/results/errors, **Load example** with the bundled prewritten result labeled **Saved example — not a live review**, editing either field clears the result.
5. Stubbed-model tests: invented quote dropped → `unclear`; valid draft quote kept.
6. Reviewer README (who it helps, how it works, what it cannot verify, local run without a model key, production link, full endpoint URL, curl with real hostname).

## Blockers
- **Push not done:** step 1 asked for a push, but the token pasted in chat must not be written to any file, commit, or log. The sandbox has no git credential store, so pushing needs either (a) the token supplied as a secret/env var by you, or (b) you running the push, or (c) me pushing with the token passed only in-memory on the command line — which also lands it in the shell's process list/scrollback, so I left it as your call.
- **No deployment yet:** Vercel deploy needs your account (login/link or a Vercel token). Nothing has been deployed; no production URL exists yet.
- **Token hygiene:** the token pasted in this chat is in the conversation transcript. Rotate it after this step if you are not comfortable with that, and scope it to this one repo.

## Known bugs / untested
- Page and API are verified locally only, **not** on production (nothing is live).
- Next 16 rewrote `tsconfig.json` on first build (`jsx: react-jsx`, added `.next/dev/types` to `include`); `tsconfig.tsbuildinfo` is generated and left untracked/ignored.
- Free-tier Gemini model choice not yet confirmed (must verify free access before integrating; no paid fallback allowed).
- `GEMINI_API_KEY` not set anywhere yet (deferred to the live-review step).

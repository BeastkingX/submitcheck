# PROGRESS

_Last updated: 2026-11-20 (kickoff: docs + ignore-file commit only)_

## Done
- Created `SPEC.md` — full kickoff spec pasted verbatim (curly quotes and em dashes preserved).
- Created `.gitignore` **before the first commit**: ignores `.env`, `.env.*`, `.vercel/`, `node_modules/`, `.next/`, `out/`, `build/`, `dist/`, coverage/test caches, logs, OS/editor files.
- Created this `PROGRESS.md`.

## Next (awaiting user's first implementation step)
1. **Scaffold** Next.js (App Router) + TypeScript in place, no folder-structure changes beyond the standard scaffold.
2. **Deploy early:** minimal page + `POST /api/agent` returning a clear "not ready" JSON error (never fake analysis) → Vercel Hobby, confirm the public HTTPS URL.
3. **Wire live review:** one server-side Gemini free-tier call per review, `GEMINI_API_KEY` only as a Vercel env var (server-side read, no `NEXT_PUBLIC_`, no local `.env`), timeout + no retries.
4. **Server-side validation:** 10,000-char caps, `400` on invalid input, exact-substring evidence check on quotes (`met` → draft only; otherwise rules or draft), invented quote → `quote: null`, `status: "unclear"`, reason `The quoted evidence could not be found in the pasted text.`, `met` without quote → `unclear`.
5. **UI:** two textareas, **Check submission** button, loading/results/errors, verbatim limitations note, **Load example** with bundled prewritten result labeled **Saved example — not a live review**, editing either field clears the result.
6. **Tests:** local stubbed-model tests — invented quote dropped → `unclear`; valid draft quote kept.
7. **README:** who it helps, how it works, what it cannot verify, local run without a model key, production demo link, full endpoint URL, curl command with the real hostname.

## Known bugs / untested / open items
- **Not pushed:** no repo URL or token was supplied with the kickoff, so commits so far are local only. Nothing has been pushed and nothing has been deployed. Repo URL still needed.
- No app code, no deployment, no model call yet — nothing beyond the docs/ignore commit has been verified.
- Free-tier Gemini model choice not yet confirmed (must verify free access before integrating; no paid fallback).
- Production hostname not yet known; README link and curl command are placeholders (`YOUR-PROJECT.vercel.app`) until the first deploy.
- `GEMINI_API_KEY` not yet set in Vercel (deferred until the live-review step, per spec).

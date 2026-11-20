# PROGRESS

_Last updated: 2026-11-20 (repo pushed to GitHub; vercel.json removed)_

## Done
- `SPEC.md` — full kickoff spec, pasted verbatim (curly quotes and em dashes preserved).
- `.gitignore` — created **before the first commit**: `.env`, `.env.*`, `.vercel/`, dependencies, build output, caches, logs, OS/editor files.
- **Step 1: minimal Next.js shell.**
  - Next.js 16.4.6 (App Router) + TypeScript + React 19, scaffolded by hand in the existing repo; kickoff files and ignore rules untouched.
  - `src/app/page.tsx` — shows the title **SubmitCheck**, a "not ready" status line, the exact limitations note (“This checks the text you paste. It does not verify links work or guarantee eligibility.”), and a one-line note that `POST /api/agent` exists.
  - `src/app/api/agent/route.ts` — `POST` returns **HTTP 503** with `{"error":"Live review is not ready yet."}`. No fake analysis.
  - `npm run build` passes; `tsc --noEmit` passes.
  - **Verified locally** on a production build (`next start`): page `200` with title + note, endpoint `503` with the exact JSON body.

- **Repo pushed to GitHub.** `main` pushed to `BeastkingX/submitcheck` (no force); `vercel.json` removed in favour of Vercel's auto-detected Next.js preset. Commits now authored as `BeastkingX <205349110+BeastkingX@users.noreply.github.com>`.
- **Removed `vercel.json`.** It only set `framework: "nextjs"`, which Vercel detects automatically; nothing else referenced it.
- **Step 1 follow-up: packaged the verified build as `submitcheck.bundle`** for a push from outside this sandbox. Bundle contains `main` = kickoff commit → scaffold commit → merge commit (including the original GitHub `Initial commit` lineage). Verified with `git bundle verify` and by cloning into a fresh temp folder.

## Next
1. **Deploy this shell to Vercel Hobby** → capture the production URL, then re-run the curl check against it. (Blocked on GitHub/Vercel access — see below.)
2. Then: live review (one server-side Gemini free-tier call, timeout, no retries; `GEMINI_API_KEY` only as a Vercel env var).
3. Server-side validation: 10,000-char caps, `400` on invalid input, exact-substring evidence check (`met` → draft only; otherwise rules or draft), invented quote → `quote: null` + `unclear` + reason `The quoted evidence could not be found in the pasted text.`, `met` without quote → `unclear`.
4. UI: two textareas, **Check submission** button, loading/results/errors, **Load example** with the bundled prewritten result labeled **Saved example — not a live review**, editing either field clears the result.
5. Stubbed-model tests: invented quote dropped → `unclear`; valid draft quote kept.
6. Reviewer README (who it helps, how it works, what it cannot verify, local run without a model key, production link, full endpoint URL, curl with real hostname).

## Blockers
- **Repo is pushed.** `main` on GitHub is `1f7414745e9379e93dfbe3d64b1fadec0da93f76`; the GitHub-linked Vercel project auto-deploys from `main` (owned by the user, not verified from here).
- **Deployment Protection (needs you).** As of the last anonymous check, the project used protection `all_except_custom_domains`, so the page returned **302 "Protected by Vercel Authentication"** and `POST /api/agent` returned **401**. Not re-checked after this push; if it still applies, set Settings -> Deployment Protection -> Vercel Authentication: **Disabled** so the demo is public.
- **Arena Vercel connector bug (no longer on the critical path).** `create_deployment` rejects any `files[].data` starting with `{` (`400 files[0].data should be string`), so JSON manifests could not be uploaded. Git-triggered deploys avoid this path entirely.
- **Superseded:** the old plan to hand-push a `.bundle`, and the stale note that remote `main` was `95b28d4`. Both are resolved.

## Known bugs / untested
- **Production verification is outstanding.** No post-push deploy has been observed from here: the page, the limitations note, and `503 {"error":"Live review is not ready yet."}` are verified locally only.
- **Other untested items:** alias state after the earlier cleanup (`submitcheck-two.vercel.app` was 404); Node 26 on Vercel vs Node 20 locally; whether Vercel's Next.js preset still auto-detects without `vercel.json` (it is documented to).

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
- **Push blocked (verified).** `git push origin main` → `fatal: could not read Username for 'https://github.com': No such device or address` (exit 128). No credential helper or token exists in this sandbox, and the pasted token must not be written into any file, commit, or log — so the push needs you. Exact command is below.
- **Remote already had history.** GitHub `BeastkingX/submitcheck` had one unrelated commit (`95b28d4 "Initial commit"`, containing only `README.md`). Merged it in (`--allow-unrelated-histories`, merge commit `26ee724`) instead of force-pushing, so nothing was overwritten.
- **No deployment yet.** Vercel deploy needs your account (import the repo, or a Vercel token). Nothing is live; there is no production URL yet.
- **Token hygiene:** the token was pasted in chat, so it is in the transcript. Rotate it after this step, and keep it scoped to this one repo.

## Known bugs / untested
- Page and API are verified locally only, **not** on production (nothing is live).
- Next 16 rewrote `tsconfig.json` on first build (`jsx: react-jsx`, added `.next/dev/types` to `include`); `tsconfig.tsbuildinfo` is generated and left untracked/ignored.
- Free-tier Gemini model choice not yet confirmed (must verify free access before integrating; no paid fallback allowed).
- `GEMINI_API_KEY` not set anywhere yet (deferred to the live-review step).

## Exact commands for you (push + verify the remote)

```sh
# from a clone of the repo, with your token available to git (not written to a file):
cd submitcheck
git add -A && git commit -m "wip"   # only if needed
git push origin main

# verify what landed on GitHub
git ls-remote --heads origin main
```

Then, once Vercel is connected, verify production:

```sh
curl -i -X POST 'https://YOUR-PROJECT.vercel.app/api/agent' \
  -H 'Content-Type: application/json' \
  --data '{"rules":"Include a public HTTPS agent endpoint.","draft":"Demo page: https://example.com/"}'

# expect: HTTP/2 503 and {"error":"Live review is not ready yet."}
```

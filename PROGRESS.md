# PROGRESS

_Last updated: 2026-11-20 (Step 1 follow-up: push/deploy blocked on missing authorization)_

## Done
- `SPEC.md` — full kickoff spec, pasted verbatim (curly quotes and em dashes preserved).
- `.gitignore` — created **before the first commit**: `.env`, `.env.*`, `.vercel/`, dependencies, build output, caches, logs, OS/editor files.
- **Step 1: minimal Next.js shell.**
  - Next.js 16.4.6 (App Router) + TypeScript + React 19, scaffolded by hand in the existing repo; kickoff files and ignore rules untouched.
  - `src/app/page.tsx` — shows the title **SubmitCheck**, a "not ready" status line, the exact limitations note (“This checks the text you paste. It does not verify links work or guarantee eligibility.”), and a one-line note that `POST /api/agent` exists.
  - `src/app/api/agent/route.ts` — `POST` returns **HTTP 503** with `{"error":"Live review is not ready yet."}`. No fake analysis.
  - `npm run build` passes; `tsc --noEmit` passes.
  - **Verified locally** on a production build (`next start`): page `200` with title + note, endpoint `503` with the exact JSON body.

- **Step 1 follow-up: packaged the verified build as `submitcheck.bundle`** for a push from outside this sandbox. Bundle contains `main` = kickoff commit → scaffold commit → merge commit (including the original GitHub `Initial commit` lineage). Verified with `git bundle verify` and by cloning into a fresh temp folder.

## Next
1. **Deploy this shell to Vercel Hobby** → capture the production URL, then re-run the curl check against it. (Blocked on GitHub/Vercel access — see below.)
2. Then: live review (one server-side Gemini free-tier call, timeout, no retries; `GEMINI_API_KEY` only as a Vercel env var).
3. Server-side validation: 10,000-char caps, `400` on invalid input, exact-substring evidence check (`met` → draft only; otherwise rules or draft), invented quote → `quote: null` + `unclear` + reason `The quoted evidence could not be found in the pasted text.`, `met` without quote → `unclear`.
4. UI: two textareas, **Check submission** button, loading/results/errors, **Load example** with the bundled prewritten result labeled **Saved example — not a live review**, editing either field clears the result.
5. Stubbed-model tests: invented quote dropped → `unclear`; valid draft quote kept.
6. Reviewer README (who it helps, how it works, what it cannot verify, local run without a model key, production link, full endpoint URL, curl with real hostname).

## Blockers
- **Access audit (2026-11-20, this step):**
  - Arena **GitHub connector does not exist** (`list_connector_tools github` → `unsupported`), so no OAuth path to push.
  - Arena **Vercel connector is disconnected** (`list_connector_tools vercel` → `disconnected`); it needs you to connect it before I can use it.
  - Sandbox has **no git credential helper, no `gh`, no `vercel` CLI, and no GitHub/Vercel token in the environment** (checked env var names only, no values).
  - Vercel API is reachable but unauthenticated: `GET https://api.vercel.com/v2/user` → `403 {"error":{"code":"forbidden","message":"The request is missing an authentication token","missingToken":true}}`.
  - Remote `refs/heads/main` is still `95b28d4` (the original README-only commit) — **confirmed unchanged**, so no push has happened.
  - Pasted chat token intentionally **not** used; it should be revoked.
- **Push: still pending.** `git push origin main` fails here — no credentials in this sandbox (`fatal: could not read Username for 'https://github.com'`, exit 128). The pasted token was never written to a file or bundled. Workaround shipped: `submitcheck.bundle`.
- **Deployment: still pending.** Nothing is live on Vercel; there is no production URL yet. Needs you to import the repo on Vercel Hobby.
- **Remote already had history.** GitHub `BeastkingX/submitcheck` had one unrelated commit (`95b28d4 "Initial commit"`, only `README.md`). Merged in with `--allow-unrelated-histories` (merge commit `c3a79ea`) instead of force-pushing — nothing of yours was overwritten, so the bundle must be pushed with a normal (non-force) push.
- **Token hygiene:** the token was pasted in chat, so it is in the transcript. Rotate it after this step and keep it scoped to this one repo.

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

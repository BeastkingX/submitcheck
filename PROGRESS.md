# PROGRESS

_Last updated: 2026-11-20 (Step 2A: live review API pushed and deployed)_

## Done
- `SPEC.md` — full kickoff spec, pasted verbatim (curly quotes and em dashes preserved).
- `.gitignore` — created **before the first commit**: `.env`, `.env.*`, `.vercel/`, dependencies, build output, caches, logs, OS/editor files.
- **Step 1: minimal Next.js shell.**
  - Next.js 16.4.6 (App Router) + TypeScript + React 19, scaffolded by hand in the existing repo; kickoff files and ignore rules untouched.
  - `src/app/page.tsx` — shows the title **SubmitCheck**, a "not ready" status line, the exact limitations note (“This checks the text you paste. It does not verify links work or guarantee eligibility.”), and a one-line note that `POST /api/agent` exists.
  - `src/app/api/agent/route.ts` — `POST` returns **HTTP 503** with `{"error":"Live review is not ready yet."}`. No fake analysis.
  - `npm run build` passes; `tsc --noEmit` passes.
  - **Verified locally** on a production build (`next start`): page `200` with title + note, endpoint `503` with the exact JSON body.

- **Step 2A: live review API.** `POST /api/agent` now does real review:
  - `src/lib/agent.ts` — pure, framework-free logic: body parsing, Gemini REST call, model-output validation, evidence check.
  - `src/app/api/agent/route.ts` — thin Next handler that reads `GEMINI_API_KEY` / `GEMINI_MODEL` server-side and delegates.
  - Validation before any provider call: malformed JSON, non-object body, missing/non-string/blank/over-10,000-char `rules` or `draft` → **400** with a specific message (`Invalid input must make zero provider calls`). Missing/blank env vars → **503** config error, no provider call.
  - One `POST /v1beta/models/{model}:generateContent` with `x-goog-api-key`, `candidateCount: 1`, `responseMimeType: "application/json"`, `responseJsonSchema` = fixed SubmitCheck schema, `thinkingConfig: {thinkingLevel: "MINIMAL"}`, 15 s `AbortController` timeout, **no retries**. Pasted text is delimited as data inside `<<<RULES … RULES>>>` / `<<<DRAFT … DRAFT>>>` with an explicit "not instructions" preamble.
  - Model output is re-validated server-side (top-level `requirements` array; exactly `requirement`/`status`/`quote`/`reason`; status ∈ met|missing|unclear; quote string-or-null; non-empty reason). Malformed/incomplete → **502** with a generic message; invalid status rejected.
  - Errors: quota/rate limit (HTTP 429 or `RESOURCE_EXHAUSTED`) → **429** `{"error":"The live review quota has been reached. Please try again later."}`; timeout → **504**; other provider failures → **502**. Provider error bodies are never returned or logged; pasted text and secrets are never logged.
  - Evidence check (replaces the old exact-match rule, SPEC.md updated): normalizes whitespace and curly→straight quotes on both sides, keeps case/punctuation, returns the **original** excerpt. `met` requires a draft excerpt, else → `unclear` + `quote: null` + the exact "could not be found" reason; `met` with no quote → `unclear`.
  - `npm test` (`node --test`, Node 24, no key needed) covers all of the above with a stubbed `fetch`: **27 tests, 27 pass**.
  - **Pushed and deployed.** `174481b..74fda8f` on `main` (commits `da0cc57`, `74fda8f`), no force. Re-verified from a clean clone on Node 24: `npm ci` → 27/27 tests → `npm run build` exit 0.
  - **Verified in production:** `POST /api/agent` with malformed JSON → **400** `{"error":"Request body must be valid JSON."}`; blank `rules` → **400** `{"error":"\`rules\` must not be blank."}`; valid input → **503** `{"error":"Live review is not configured on this server."}` (correct: env vars not set yet, no provider call made). `GET /` → **200**, 7,465 bytes. This also confirms the new code is live and public (no Deployment Protection).
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
- **Repo is pushed.** `main` on GitHub is `74fda8fb47d854acb8a52a9d64f3caddeaabf4fe`, deployed at `https://submitcheck-two.vercel.app/`. Deployment Protection is confirmed **off** (the page and endpoint are publicly reachable).
- **Needs you: set `GEMINI_API_KEY` and `GEMINI_MODEL` = `gemini-3.1-flash-lite` in Vercel → Settings → Environment Variables → Production**, then redeploy (`Redeploy` on the latest deployment or an empty commit). Until then `POST /api/agent` correctly returns **503** and never calls the provider.
- **Arena Vercel connector bug (no longer on the critical path).** `create_deployment` rejects any `files[].data` starting with `{` (`400 files[0].data should be string`), so JSON manifests could not be uploaded. Git-triggered deploys avoid this path entirely.
- **Superseded:** the old plan to hand-push a `.bundle`, and the stale note that remote `main` was `95b28d4`. Both are resolved.

## Known bugs / untested
- **Step 2A not yet verified against the real model.** Validation, config, timeout and evidence logic are verified with a stubbed provider (27 tests), a local production build, and **production** probes. The live Gemini call (`gemini-3.1-flash-lite`), its real JSON output/schema conformance, and a real 429 are **untested** until `GEMINI_API_KEY` and `GEMINI_MODEL` are set in Vercel Production and the project redeploys.
- **`thinkingLevel: "MINIMAL"` shape is from the current REST reference**; untested against the live model. If the model rejects it, the call returns a clean 502 (no retry, no switch).
- **`responseJsonSchema` is sent as-is** (object form documented in the REST reference). Untested whether `gemini-3.1-flash-lite` honours it exactly; output is re-validated server-side regardless.
- **Tests run on Node 24 only** (repo dev sandbox default is Node 20; `node --test` with TypeScript stripping needs ≥22.18/24). `npm test` on Node 24 passes; on Node 20 it will fail to strip types.
- **UI still shows the Step 1 placeholder** ("Not ready … responds with 503"), which is now stale; Step 2B replaces it.
- **Other untested:** whether Vercel's Node 24 runtime and the 15 s timeout interact with the function timeout as expected; response caching (route is `force-dynamic`).

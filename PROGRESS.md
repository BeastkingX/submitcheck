# PROGRESS

_Last updated: 2026-11-20 (Step 1 follow-up: Vercel connected, deploy attempted, blocked by two issues)_

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
- **Deployment: blocked by two independent issues (both verified this step).**
  1. **Vercel Deployment Protection (needs you).** Project `submitcheck` (`prj_RhtONB7KGZzYJq3fKniNW90HLiVe`, team `beastkingxs-projects`, hobby) uses protection `all_except_custom_domains`. Verified anonymously: `GET https://submitcheck-beastkingxs-projects.vercel.app/` returns **302 "Protected by Vercel Authentication"**, and `POST /api/agent` returns **401** with `{"protection":{"vercel_auth_enabled":true,...}}`. A correct build still won't be public until you set Settings -> Deployment Protection -> Vercel Authentication: **Disabled**.
  2. **Arena Vercel connector bug (blocks file-based Next builds).** `create_deployment` rejects any `files[].data` whose content **starts with `{`**: HTTP 400 `files[0].data should be string` (reported as `files[1]` when it is the second entry). Verified: `{"a":1}` fails; JS containing `{ a: 1 }`, `[{...}][0]`, leading-newline, and interleaved U+FEFF all pass, and BOM-prefixed JSON then fails at build with `enoent: Unexpected token '\ufeff'`. So `package.json`, `package-lock.json` and `tsconfig.json` cannot be uploaded, and a buildable Next.js deploy can't be assembled through the connector without a workaround I won't apply silently (splitting JSON across files and reassembling it in the build command).
- **Milestone not met.** Neither the title+limitations page nor the 503 JSON is live; both are blocked by the items above.
- **Cleanup done.** Debugging produced 17 test deployments (several `target: production`). **All 15 non-original ones were deleted**, including the stub that had taken the production alias. The project's production deployment is back to the original README-only build `dpl_7JhrA2jTbP32b13rHWYTisvAnrHN` (`95b28d4`).
- **Alias state after cleanup:** `submitcheck-two.vercel.app` -> **404 DEPLOYMENT_NOT_FOUND**; `submitcheck-beastkingxs-projects.vercel.app` -> **302 (protection)**. The original deployment is still listed READY with those aliases attached; a fresh deployment should re-establish the alias.
- **Push: still pending.** No GitHub write credential in this sandbox (`list_connector_tools github` -> `unsupported`; anonymous `git ls-remote` shows remote `main` still `95b28d4`). The token pasted earlier was not used and should be revoked.

## Known bugs / untested
- **Local build verified; production build never verified.** This exact file set built locally with no `package.json` (`next build` -> `/`, `/_not-found`, `f /api/agent`), but no production deployment of it has succeeded, because of the connector bug above.
- **Local test was JS-only.** Repo sources are `.tsx`/`.ts`; the only verified local build used `.jsx`/`.js` (tsconfig is unparseable when BOM-prefixed), so type errors could still appear on a real Vercel build.
- **Content drift in the tested variant:** the locally built `page.jsx` rendered the em dash as a period ("unclear. with quotes") and a shortened status line. Repo source remains authoritative.

# SubmitCheck

## Goal and audience
SubmitCheck helps hackathon entrants catch missing submission requirements before they submit. Paste the event rules and a draft submission; the agent extracts checkable requirements, compares each with the draft, and returns a review with source quotes. Judges can run the same review from the web page or call the public JSON endpoint directly.

## Stack and scope
- Next.js (App Router) and TypeScript, deployed to Vercel Hobby on a stable public HTTPS production URL.
- One server-side call per live review to a Gemini model available on the free tier. Confirm free access before integrating; do not enable paid billing or add a paid fallback.
- Set `GEMINI_API_KEY` and `GEMINI_MODEL` only in Vercel environment variables. Read it only in server-side code. Never put it in a local `.env`, repo, browser bundle, response, or logs; never prefix it with `NEXT_PUBLIC_`. Test real model calls on Vercel and use a stub for local tests.
- No accounts, database, browsing, link checks, or zkVerify integration. The evidence check confirms that a quote exists in the input, not that the agent's interpretation is correct.

## Features in priority order
1. **Deploy early.** Put a minimal page and the `POST /api/agent` route on the public production URL. Until live review is wired up, return a clear not-ready error, not fake analysis.
2. **One live review flow.** The page has two plain-text fields (event rules and draft submission) and a **Check submission** button. Show loading, results, and useful errors. Display this note verbatim: “This checks the text you paste. It does not verify links work or guarantee eligibility.”
3. **Example that always works.** **Load example** fills both fields and immediately shows a bundled, prewritten result labeled **Saved example — not a live review**. It makes no model call. Use a draft with a demo URL but no stated agent endpoint; the result flags the endpoint as missing. Editing either field clears the displayed result so it cannot be mistaken for a review of the edited text.
4. **Reviewer README.** Explain who it helps, how it works, what it cannot verify, and how to run it locally without a model key. Link the production demo, list the full endpoint URL, and include the curl command below with the actual production hostname.

## Public API and evidence rules
`POST /api/agent` accepts JSON with two nonblank strings: `rules` and `draft`. Cap each at 10,000 characters. Successful responses use this fixed shape, one entry per extracted requirement:

```json
{
  "requirements": [
    {
      "requirement": "Provide a public HTTPS agent endpoint",
      "status": "missing",
      "quote": "Include a public HTTPS agent endpoint.",
      "reason": "The draft lists a demo page but does not name an agent endpoint."
    }
  ]
}
```

- `status` is exactly `met`, `missing`, or `unclear`. `quote` is one verbatim excerpt or `null`; `reason` is one short line. Optional suggestions are not mandatory requirements. A `met` verdict needs evidence from the draft, not merely wording copied from the rules. For `missing`, a quote from the rules can show what's required, not prove absence.
- Validate the model output on the server. For every non-null quote, locate it in the original pasted text (draft only for `met`; rules or draft otherwise). Before comparing, trim, collapse runs of whitespace, and map curly single and double quotes to straight equivalents in both the quote and the source; keep case and other punctuation unchanged. On a match, return the original pasted excerpt, not the model's rewritten text. If a quote does not match, set `quote` to `null`, change `status` to `unclear`, and replace the reason with `The quoted evidence could not be found in the pasted text.` A `met` item without a usable quote also becomes `unclear` with a short explanation.
- Reject invalid input with `400`. Return a clear JSON error if the model is unavailable, times out, exceeds its quota, or returns malformed data. Use a timeout, and make **at most one retry, only for transient provider failures (HTTP 500, 502, 503 or 504)**; never retry a `429`, any other `4xx`, a timeout, a network error, or malformed model output, and never change the model to work around a failure. The per-attempt timeout and function duration must leave room for both attempts inside Vercel's Hobby limit (300 s). Never silently substitute the saved example for a live review. Don't log pasted text; tell users to omit sensitive information.

README example (replace `YOUR-PROJECT.vercel.app` with the production hostname):

```sh
curl -sS -X POST 'https://YOUR-PROJECT.vercel.app/api/agent' \
  -H 'Content-Type: application/json' \
  --data '{"rules":"Include a public HTTPS agent endpoint.","draft":"Demo page: https://example.com/"}'
```

## Done for the demo
- The production page and `POST /api/agent` work without sign-in. The README curl command returns the fixed JSON schema from a real model call and flags the missing endpoint on the sample input.
- A local test with a stubbed model output proves that an invented quote is dropped and the requirement becomes `unclear`; another proves that a valid draft quote is kept.
- The example runs without a model request, the saved result is visibly labeled, and the limitations note is visible.
- The public repo and README are ready to share. Stop adding features once these checks pass.

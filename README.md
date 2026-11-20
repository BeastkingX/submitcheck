# SubmitCheck

Paste hackathon rules and a draft submission; get a review of what is **met**, **missing**, or **unclear** — with quotes taken from your own text.

- **Live demo:** https://submitcheck-two.vercel.app/
- **Public API:** `POST https://submitcheck-two.vercel.app/api/agent`
- **Repository:** https://github.com/BeastkingX/submitcheck

## Who it helps

Hackathon entrants checking a draft against the rules before they submit. It is built for the last hour before the deadline, when the rules page is long, the draft is spread across a form, and the thing that costs you points is a requirement nobody re-read: a missing demo link, an unstated network, a walkthrough that was never recorded.

Judges and reviewers can use it the same way — the page and the JSON endpoint run the same review.

## How it works

1. You paste two blocks of plain text: the **event rules** and your **draft submission**.
2. The page sends `{"rules": "...", "draft": "..."}` to `POST /api/agent`.
3. The server makes **one** call to a Gemini model (free tier) with a fixed JSON schema, and asks for a list of checkable requirements, each marked `met`, `missing`, or `unclear`, with a short reason and — where relevant — a quote.
4. The server then **verifies every quote** against the text you pasted: it trims, collapses runs of whitespace, and treats curly and straight quotes as equivalent (case and other punctuation stay as-is). For `met`, the quote must come from your **draft**; otherwise it may come from the rules or the draft. The excerpt returned is your original wording, never the model's rewrite.
5. If a quote cannot be found, that item is downgraded to `unclear`, its quote is dropped, and the reason becomes `The quoted evidence could not be found in the pasted text.` A `met` with no usable quote is downgraded the same way.

One review per request, a 15-second timeout, no retries, no browsing, and no paid fallback. Inputs are capped at 10,000 characters each; invalid input is rejected with `400` before the model is called.

### The saved example

**Load example** fills both fields and instantly shows a bundled, prewritten result labelled **Saved example — not a live review**. It never calls the API — you can see this in the browser's Network tab, and it still works with the network offline. It exists so the page always has something to show, even if the model is down or the free-tier quota is exhausted. Editing either field clears the result.

### The live review uses a free-tier model

The live review runs on a Gemini model on the **free tier**, which has daily request limits. A quota error is therefore possible, and when it happens the page shows the API's own message (`The live review quota has been reached. Please try again later.`) rather than making something up. The saved example has no such limit and always works.

## What it cannot verify

- **Links.** It reads text. It does not open your demo, check that a URL resolves, or confirm a video is playable.
- **Eligibility.** It does not check team size, residency, age, prior-work rules, or anything about who you are.
- **Interpretation.** The evidence check proves a quote exists in your text. It does not prove the model read that sentence the way a judge will.
- **Completeness.** It reports what it extracted. A requirement it never noticed will not appear in the result, and a clean review is not a guarantee of a pass.

The page always shows this note: *This checks the text you paste. It does not verify links work or guarantee eligibility.*

## Run it locally without a model key

Requires Node.js 24 (the API's tests use Node's built-in TypeScript support; Node 22.18+ also works).

```sh
git clone https://github.com/BeastkingX/submitcheck.git
cd submitcheck
npm ci
npm test          # stub-only tests, no model key needed
npm run typecheck
npm run build
npm start         # http://localhost:3000
```

**Load example** works with no key at all. Pressing **Check submission** without one shows a clear configuration error and makes no model call.

To run a live review locally you would need a key, but this project deliberately keeps `GEMINI_API_KEY` out of local `.env` files, the repo, and the browser bundle — keys are set only in Vercel. Locally, expect the `503` configuration error.

### Tests

`npm test` runs `node --test` against stubbed provider responses — no network, no key, no quota used:

- whitespace/quote-style drift still matches and returns the original excerpt
- an invented quote becomes `unclear` with `quote: null`
- a rules-only quote cannot justify `met`
- invalid and over-limit input returns `400` with zero provider calls
- the outgoing request carries `responseMimeType: "application/json"`, the fixed schema, and `thinkingLevel: "MINIMAL"`
- an invalid `status` from the model is rejected
- a simulated quota error returns the specified `429` after exactly one call
- every quote in the bundled saved example appears verbatim in the example text, and every `met` item quotes the draft

## API

`POST /api/agent` accepts JSON with two non-blank strings, `rules` and `draft`, each at most 10,000 characters.

```sh
curl -sS -X POST 'https://submitcheck-two.vercel.app/api/agent' \
  -H 'Content-Type: application/json' \
  --data '{"rules":"Include a public HTTPS agent endpoint.","draft":"Demo page: https://example.com/"}'
```

A successful response (`200`) uses this fixed shape — one entry per extracted requirement:

```json
{
  "requirements": [
    {
      "requirement": "Include a public HTTPS agent endpoint.",
      "status": "missing",
      "quote": "Include a public HTTPS agent endpoint.",
      "reason": "The draft lists a demo page but does not name an agent endpoint."
    }
  ]
}
```

`status` is exactly `met`, `missing`, or `unclear`; `quote` is one verbatim excerpt from your text or `null`; `reason` is one short line.

Errors are JSON too, with a short `error` message:

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON, a missing/blank field, or more than 10,000 characters. No model call is made. |
| `429` | The free-tier quota has been reached. |
| `502` | The model was unavailable or returned something unusable. |
| `503` | The server is not configured with a model key. |
| `504` | The model took longer than 15 seconds. |

## Notes

- No accounts, no database, no cookies, no analytics.
- Pasted text is sent to Google Gemini to produce the review, and is not logged by this app. Don't paste private or sensitive information.
- Built with Next.js (App Router) and TypeScript on Vercel Hobby.

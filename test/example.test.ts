import test from "node:test";
import assert from "node:assert/strict";

import { applyEvidenceCheck, findExcerpt } from "../src/lib/agent.ts";
import {
  EXAMPLE_DRAFT,
  EXAMPLE_RESULT,
  EXAMPLE_RULES,
} from "../src/lib/example.ts";

// The bundled saved example must survive the same evidence rules the server
// applies to a live review, otherwise the page would show proof the API would
// have dropped.

test("every quote in the saved example appears verbatim in its source text", () => {
  assert.ok(EXAMPLE_RESULT.length > 0, "example must have at least one item");

  for (const item of EXAMPLE_RESULT) {
    if (item.quote === null) continue;
    assert.ok(
      findExcerpt(EXAMPLE_RULES, item.quote) !== null ||
        findExcerpt(EXAMPLE_DRAFT, item.quote) !== null,
      `quote not found verbatim in the example text: ${JSON.stringify(item.quote)}`,
    );
  }
});

test("every 'met' item in the saved example quotes the draft, not the rules", () => {
  const met = EXAMPLE_RESULT.filter((item) => item.status === "met");
  assert.ok(met.length > 0, "example must contain at least one met item");

  for (const item of met) {
    assert.ok(item.quote !== null && item.quote.trim() !== "", "met needs a quote");
    assert.notEqual(
      findExcerpt(EXAMPLE_DRAFT, item.quote as string),
      null,
      `met quote is not in the draft: ${JSON.stringify(item.quote)}`,
    );
  }
});

test("the saved example flags the missing agent endpoint", () => {
  const missing = EXAMPLE_RESULT.filter((item) => item.status === "missing");
  assert.ok(missing.length > 0, "example must contain a missing item");
  assert.ok(
    missing.some((item) => /agent endpoint/i.test(item.requirement)),
    "one missing item must be about the agent endpoint",
  );
});

test("the example draft has a demo URL but no agent endpoint", () => {
  assert.match(EXAMPLE_DRAFT, /https:\/\/[^\s]*orbit-demo[^\s]*/);
  assert.doesNotMatch(EXAMPLE_DRAFT, /\/api\/agent/i);
  assert.doesNotMatch(EXAMPLE_DRAFT, /agent endpoint/i);
});

test("the saved example is unchanged by the server evidence check", () => {
  const checked = applyEvidenceCheck(EXAMPLE_RESULT, {
    rules: EXAMPLE_RULES,
    draft: EXAMPLE_DRAFT,
  });
  assert.deepEqual(checked, EXAMPLE_RESULT);
});

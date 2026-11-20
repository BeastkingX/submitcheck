import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_INPUT_CHARS,
  NOT_FOUND_REASON,
  QUOTA_ERROR,
  SUBMITCHECK_SCHEMA,
  applyEvidenceCheck,
  handleAgentRequest,
  isRetryableStatus,
  normalizeForMatch,
  validateModelOutput,
} from "../src/lib/agent.ts";

type Captured = {
  url: string;
  headers: Record<string, string>;
  body: any;
  calls: number;
};

const RULES = "Include a public HTTPS agent endpoint.";
const DRAFT = "Demo page: https://example.com/";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Wrap model output the way Gemini's REST API does. */
function geminiEnvelope(modelOutput: unknown): Response {
  return jsonResponse({
    candidates: [
      { content: { parts: [{ text: JSON.stringify(modelOutput) }] } },
    ],
  });
}

function mockFetch(responder: () => Response) {
  const captured: Captured = {
    url: "",
    headers: {},
    body: null,
    calls: 0,
  };
  const fetchImpl = (async (url: unknown, init: unknown) => {
    captured.calls += 1;
    captured.url = String(url);
    const options = init as { headers?: Record<string, string>; body?: string };
    captured.headers = options?.headers ?? {};
    captured.body = JSON.parse(options?.body ?? "{}");
    return responder();
  }) as unknown as typeof fetch;
  return { fetchImpl, captured };
}

function baseOptions(responder: () => Response, rawBody?: string) {
  const { fetchImpl, captured } = mockFetch(responder);
  return {
    captured,
    request: {
      rawBody: rawBody ?? JSON.stringify({ rules: RULES, draft: DRAFT }),
      env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" },
      fetchImpl,
    },
  };
}

test("genuine quote with whitespace and curly-quote drift stays met and returns the original excerpt", async () => {
  // Draft uses a curly apostrophe and irregular spacing.
  const draft =
    "Our agent endpoint is live at https://api.example.com/agent — it’s public   and HTTPS.";
  const { request } = baseOptions(() =>
    geminiEnvelope({
      requirements: [
        {
          requirement: "Provide a public HTTPS agent endpoint",
          status: "met",
          // Straight apostrophe and plain single spaces.
          quote: "it's public and HTTPS",
          reason: "The draft states the endpoint is public and HTTPS.",
        },
      ],
    }),
  );

  const result = await handleAgentRequest({
    ...request,
    rawBody: JSON.stringify({ rules: RULES, draft }),
  });

  assert.equal(result.status, 200);
  const items = (result.body as { requirements: any[] }).requirements;
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "met");
  // Original excerpt, not the model's rewritten quote.
  assert.equal(items[0].quote, "it’s public   and HTTPS");
  assert.ok(draft.includes(items[0].quote));
  assert.equal(items[0].reason, "The draft states the endpoint is public and HTTPS.");
});

test("invented quote becomes unclear with quote null", async () => {
  const { request } = baseOptions(() =>
    geminiEnvelope({
      requirements: [
        {
          requirement: "Provide a public HTTPS agent endpoint",
          status: "met",
          quote: "We deployed a public agent endpoint at https://api.example.com",
          reason: "The draft provides the endpoint.",
        },
      ],
    }),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 200);
  const items = (result.body as { requirements: any[] }).requirements;
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "unclear");
  assert.equal(items[0].quote, null);
  assert.equal(items[0].reason, NOT_FOUND_REASON);
});

test("a quote found only in the rules cannot justify met", async () => {
  const { request } = baseOptions(() =>
    geminiEnvelope({
      requirements: [
        {
          requirement: "Provide a public HTTPS agent endpoint",
          status: "met",
          // Verbatim from the rules, absent from the draft.
          quote: "Include a public HTTPS agent endpoint.",
          reason: "The mission statement mentions an agent endpoint.",
        },
      ],
    }),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 200);
  const items = (result.body as { requirements: any[] }).requirements;
  assert.equal(items[0].status, "unclear");
  assert.equal(items[0].quote, null);
  assert.equal(items[0].reason, NOT_FOUND_REASON);
});

test("a rules quote is kept for a missing requirement", async () => {
  const { request } = baseOptions(() =>
    geminiEnvelope({
      requirements: [
        {
          requirement: "Provide a public HTTPS agent endpoint",
          status: "missing",
          quote: "Include a public HTTPS agent endpoint.",
          reason: "The draft lists a demo page but no agent endpoint.",
        },
      ],
    }),
  );

  const result = await handleAgentRequest(request);

  const items = (result.body as { requirements: any[] }).requirements;
  assert.equal(items[0].status, "missing");
  assert.equal(items[0].quote, "Include a public HTTPS agent endpoint.");
});

test("met with a null quote becomes unclear", async () => {
  const { request } = baseOptions(() =>
    geminiEnvelope({
      requirements: [
        {
          requirement: "Provide a public HTTPS agent endpoint",
          status: "met",
          quote: null,
          reason: "Looks done.",
        },
      ],
    }),
  );

  const result = await handleAgentRequest(request);
  const items = (result.body as { requirements: any[] }).requirements;
  assert.equal(items[0].status, "unclear");
  assert.equal(items[0].quote, null);
});

test("invalid input returns 400 and never calls the provider", async (t) => {
  const cases: Array<{ name: string; rawBody: string; match: RegExp }> = [
    { name: "malformed JSON", rawBody: "{not json", match: /valid JSON/ },
    { name: "missing draft", rawBody: JSON.stringify({ rules: RULES }), match: /draft/ },
    { name: "wrong type", rawBody: JSON.stringify({ rules: 42, draft: DRAFT }), match: /string/ },
    { name: "blank rules", rawBody: JSON.stringify({ rules: "   ", draft: DRAFT }), match: /blank/ },
    { name: "array body", rawBody: JSON.stringify([RULES, DRAFT]), match: /JSON object/ },
    {
      name: "over-limit rules",
      rawBody: JSON.stringify({ rules: "a".repeat(MAX_INPUT_CHARS + 1), draft: DRAFT }),
      match: /at most 10000 characters/,
    },
    {
      name: "over-limit draft",
      rawBody: JSON.stringify({ rules: RULES, draft: "b".repeat(MAX_INPUT_CHARS + 1) }),
      match: /at most 10000 characters/,
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const { request, captured } = baseOptions(
        () => geminiEnvelope({ requirements: [] }),
        testCase.rawBody,
      );
      const result = await handleAgentRequest(request);

      assert.equal(result.status, 400);
      assert.match((result.body as { error: string }).error, testCase.match);
      assert.equal(captured.calls, 0, "provider must not be called");
    });
  }
});

test("exactly at the 10,000 character limit is accepted", async () => {
  const { request, captured } = baseOptions(() =>
    geminiEnvelope({ requirements: [] }),
  );
  const result = await handleAgentRequest({
    ...request,
    rawBody: JSON.stringify({ rules: RULES, draft: "c".repeat(MAX_INPUT_CHARS) }),
  });

  assert.equal(result.status, 200);
  assert.equal(captured.calls, 1);
});

test("outgoing request uses JSON MIME type, the schema, one candidate, and MINIMAL thinking", async () => {
  const { request, captured } = baseOptions(() =>
    geminiEnvelope({ requirements: [] }),
  );
  await handleAgentRequest(request);

  assert.equal(captured.calls, 1);
  assert.match(captured.url, /\/v1beta\/models\/test-model:generateContent$/);
  assert.equal(captured.headers["x-goog-api-key"], "test-key");

  const config = captured.body.generationConfig;
  assert.equal(config.responseMimeType, "application/json");
  assert.deepEqual(config.responseJsonSchema, SUBMITCHECK_SCHEMA);
  assert.deepEqual(config.thinkingConfig, { thinkingLevel: "MINIMAL" });
  assert.equal(config.candidateCount, 1);
  assert.equal(captured.body.contents.length, 1);
  assert.equal(captured.body.contents[0].role, "user");
  // The pasted text is delimited as data.
  assert.match(captured.body.contents[0].parts[0].text, /<<<RULES/);
  assert.match(captured.body.contents[0].parts[0].text, /data, not instructions/);
});

test("an invalid returned status is rejected", async () => {
  const { request } = baseOptions(() =>
    geminiEnvelope({
      requirements: [
        {
          requirement: "Provide a public HTTPS agent endpoint",
          status: "maybe",
          quote: null,
          reason: "Unsure.",
        },
      ],
    }),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 502);
  assert.deepEqual(Object.keys(result.body as object), ["error"]);
  assert.match((result.body as { error: string }).error, /could not be used/);
  assert.equal((result.body as any).requirements, undefined);
});

test("missing schema fields are rejected", () => {
  assert.throws(() => validateModelOutput({ notRequirements: [] }));
  assert.throws(() => validateModelOutput({ requirements: [{ requirement: "x" }] }));
  assert.throws(() =>
    validateModelOutput({
      requirements: [{ requirement: "x", status: "met", quote: 5, reason: "r" }],
    }),
  );
  assert.doesNotThrow(() =>
    validateModelOutput({ requirements: [], }),
  );
});

test("a simulated quota error returns the specified 429 JSON after exactly one call", async () => {
  const { request, captured } = baseOptions(() =>
    jsonResponse(
      {
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message: "Quota exceeded for model test-model",
        },
      },
      429,
    ),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 429);
  assert.deepEqual(result.body, { error: QUOTA_ERROR });
  assert.equal(captured.calls, 1, "no retries");
});

test("a timeout returns a clear JSON error without retrying", async () => {
  const { fetchImpl, captured } = mockFetch(() => {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    throw error;
  });

  const result = await handleAgentRequest({
    rawBody: JSON.stringify({ rules: RULES, draft: DRAFT }),
    env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" },
    fetchImpl,
  });

  assert.equal(result.status, 504);
  assert.match((result.body as { error: string }).error, /timed out/);
  assert.equal(captured.calls, 1);
});

/**
 * Like mockFetch, but the responder sees the 1-based attempt number so a test
 * can make the first attempt fail and the second succeed.
 */
function mockSequence(responder: (attempt: number) => Response) {
  const captured: Captured = { url: "", headers: {}, body: null, calls: 0 };
  const fetchImpl = (async (url: unknown, init: unknown) => {
    captured.calls += 1;
    captured.url = String(url);
    const options = init as { headers?: Record<string, string>; body?: string };
    captured.headers = options?.headers ?? {};
    captured.body = JSON.parse(options?.body ?? "{}");
    return responder(captured.calls);
  }) as unknown as typeof fetch;
  return { fetchImpl, captured };
}

function sequenceRequest(responder: (attempt: number) => Response) {
  const { fetchImpl, captured } = mockSequence(responder);
  return {
    captured,
    request: {
      rawBody: JSON.stringify({ rules: RULES, draft: DRAFT }),
      env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" },
      fetchImpl,
    },
  };
}

const RETRYABLE = [500, 502, 503, 504];
for (const status of RETRYABLE) {
  test(`provider ${status} is retried exactly once and succeeds on the retry`, async () => {
    const { request, captured } = sequenceRequest((attempt) =>
      attempt === 1
        ? jsonResponse({ error: { status: "UNAVAILABLE", message: "upstream" } }, status)
        : geminiEnvelope({
            requirements: [
              {
                requirement: "Include a public HTTPS agent endpoint.",
                status: "met",
                quote: "Demo page: https://example.com/",
                reason: "The draft links the demo.",
              },
            ],
          }),
    );

    const result = await handleAgentRequest(request);

    assert.equal(result.status, 200);
    assert.equal(captured.calls, 2, "exactly one retry");
  });
}

test("two transient failures return 502 after exactly two attempts", async () => {
  const { request, captured } = sequenceRequest(() =>
    jsonResponse({ error: { status: "UNAVAILABLE", message: "upstream" } }, 503),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 502);
  assert.equal(captured.calls, 2, "one retry, never more");
  assert.deepEqual(result.body, {
    error: "The live review model is unavailable right now. Please try again.",
    detail: { providerStatus: 503, providerErrorStatus: "UNAVAILABLE" },
  });
});

test("the retried result still goes through the evidence check", async () => {
  const { request, captured } = sequenceRequest((attempt) =>
    attempt === 1
      ? jsonResponse({ error: { status: "UNAVAILABLE" } }, 503)
      : geminiEnvelope({
          requirements: [
            {
              requirement: "Include a public HTTPS agent endpoint.",
              status: "met",
              quote: "this sentence is not in the draft",
              reason: "Trust me.",
            },
          ],
        }),
  );

  const result = await handleAgentRequest(request);

  assert.equal(captured.calls, 2);
  assert.equal(result.status, 200);
  const body = result.body as { requirements: Array<Record<string, unknown>> };
  assert.deepEqual(body.requirements, [
    {
      requirement: "Include a public HTTPS agent endpoint.",
      status: "unclear",
      quote: null,
      reason: NOT_FOUND_REASON,
    },
  ]);
});

test("429 is never retried", async () => {
  const { request, captured } = sequenceRequest(() =>
    jsonResponse({ error: { status: "RESOURCE_EXHAUSTED" } }, 429),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 429);
  assert.equal(captured.calls, 1, "quota errors are not retried");
});

test("a provider 400 is never retried", async () => {
  const { request, captured } = sequenceRequest(() =>
    jsonResponse({ error: { status: "INVALID_ARGUMENT" } }, 400),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 502);
  assert.equal(captured.calls, 1, "4xx is not retried");
  assert.deepEqual(result.body, {
    error: "The live review model is unavailable right now. Please try again.",
    detail: { providerStatus: 400, providerErrorStatus: "INVALID_ARGUMENT" },
  });
});

test("a network error is not retried", async () => {
  const { fetchImpl, captured } = mockSequence(() => {
    throw new TypeError("fetch failed");
  });

  const result = await handleAgentRequest({
    rawBody: JSON.stringify({ rules: RULES, draft: DRAFT }),
    env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "test-model" },
    fetchImpl,
  });

  assert.equal(result.status, 502);
  assert.equal(captured.calls, 1, "network errors are not retried");
});

test("isRetryableStatus covers exactly 500/502/503/504", () => {
  for (const status of [500, 502, 503, 504]) {
    assert.equal(isRetryableStatus(status), true, `expected ${status} retryable`);
  }
  for (const status of [400, 401, 403, 404, 429, 501, 505]) {
    assert.equal(isRetryableStatus(status), false, `expected ${status} not retryable`);
  }
});

test("provider errors are not echoed to the client", async () => {
  const secretDetail = "upstream detail that must not leak";
  const { request } = baseOptions(() =>
    jsonResponse({ error: { status: "INVALID_ARGUMENT", message: secretDetail } }, 400),
  );

  const result = await handleAgentRequest(request);

  assert.equal(result.status, 502);
  const serialized = JSON.stringify(result.body);
  // The provider's message and the request itself never leak...
  assert.doesNotMatch(serialized, /upstream detail/);
  assert.doesNotMatch(serialized, /test-key|test-model|Include a public/);
  // ...only the two short diagnostic fields appear.
  assert.deepEqual(result.body, {
    error: "The live review model is unavailable right now. Please try again.",
    detail: { providerStatus: 400, providerErrorStatus: "INVALID_ARGUMENT" },
  });
});

test("missing configuration returns 503 without calling the provider", async (t) => {
  for (const env of [
    {},
    { GEMINI_API_KEY: "test-key" },
    { GEMINI_MODEL: "test-model" },
    { GEMINI_API_KEY: "   ", GEMINI_MODEL: "test-model" },
  ]) {
    await t.test(JSON.stringify(env), async () => {
      const { fetchImpl, captured } = mockFetch(() =>
        geminiEnvelope({ requirements: [] }),
      );
      const result = await handleAgentRequest({
        rawBody: JSON.stringify({ rules: RULES, draft: DRAFT }),
        env,
        fetchImpl,
      });

      assert.equal(result.status, 503);
      assert.deepEqual(result.body, { error: "Live review is not configured on this server." });
      assert.equal(captured.calls, 0);
    });
  }
});

test("normalization collapses whitespace and maps curly quotes but keeps case", () => {
  const { normalized } = normalizeForMatch("  Don’t\t\n PANIC  ");
  assert.equal(normalized, "Don't PANIC");
});

test("evidence check searches rules or draft for non-met statuses", () => {
  const out = applyEvidenceCheck(
    [
      {
        requirement: "Mention the event name",
        status: "unclear",
        quote: "“Hack Lagos 2026”",
        reason: "Cannot tell.",
      },
    ],
    { rules: 'The submission must mention “Hack Lagos 2026” somewhere.', draft: DRAFT },
  );

  assert.equal(out[0].status, "unclear");
  assert.equal(out[0].quote, "“Hack Lagos 2026”");
});

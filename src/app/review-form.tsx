"use client";

import { useEffect, useRef, useState } from "react";

import type { Requirement, Status } from "@/lib/agent";
import { EXAMPLE_DRAFT, EXAMPLE_RESULT, EXAMPLE_RULES } from "@/lib/example";
import { MAX_INPUT_CHARS } from "@/lib/limits";

type Rendered = { kind: "live" | "saved"; requirements: Requirement[] };

const COUNTER_WARN_AT = 9_000;

const STATUS_LABEL: Record<Status, string> = {
  met: "Met",
  missing: "Missing",
  unclear: "Unclear",
};

const STATUS_ORDER: Status[] = ["met", "missing", "unclear"];

/** Inline, dependency-free status marks. Always paired with the status word. */
function StatusIcon({ status }: { status: Status }) {
  const shared = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
  if (status === "met") {
    return (
      <svg {...shared}>
        <path d="M1.75 6.5 4.5 9.25 10.25 3" />
      </svg>
    );
  }
  if (status === "missing") {
    return (
      <svg {...shared}>
        <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <path d="M4.4 4.2a1.8 1.8 0 1 1 2.4 1.7c-.55.22-.8.6-.8 1.15v.35" />
      <path d="M6 9.7v.2" />
    </svg>
  );
}

function isRequirementList(value: unknown): value is Requirement[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;
      const entry = item as Record<string, unknown>;
      return (
        typeof entry.requirement === "string" &&
        (entry.status === "met" ||
          entry.status === "missing" ||
          entry.status === "unclear") &&
        (entry.quote === null || typeof entry.quote === "string") &&
        typeof entry.reason === "string"
      );
    })
  );
}

/** Pull a readable message out of an API error response without inventing one. */
function readError(status: number, body: unknown): string {
  const message =
    body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error.trim()
      : "";
  if (message) return `Error ${status}: ${message}`;
  return `Error ${status}: the review could not be completed. Please try again.`;
}

function buildChecklist(result: Rendered): string {
  const counts = STATUS_ORDER.map(
    (status) => `${result.requirements.filter((item) => item.status === status).length} ${status}`,
  ).join(" · ");

  const lines = [
    "SubmitCheck review",
    result.kind === "saved" ? "Saved example — not a live review" : "Live review",
    counts,
    "",
  ];

  result.requirements.forEach((item, index) => {
    lines.push(`${index + 1}. [${STATUS_LABEL[item.status]}] ${item.requirement}`);
    lines.push(`   Why: ${item.reason}`);
    if (item.quote) lines.push(`   Quote: "${item.quote}"`);
    lines.push("");
  });

  lines.push(
    "This checks the text you paste. It does not verify links work or guarantee eligibility.",
  );
  return lines.join("\n");
}

export default function ReviewForm() {
  const [rules, setRules] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  // Each submission gets a sequence number; a response that is not for the
  // latest submission is dropped, and editing bumps the sequence so an
  // in-flight response can never land on top of edited text.
  const seq = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      if (inFlight.current) inFlight.current.abort();
    };
  }, []);

  function cancelInFlight() {
    seq.current += 1;
    if (inFlight.current) {
      inFlight.current.abort();
      inFlight.current = null;
    }
    setPending(false);
  }

  function clearOutput() {
    setRendered(null);
    setError(null);
    setCopyState("idle");
  }

  function handleEdit(which: "rules" | "draft", value: string) {
    // Abort/ignore any in-flight response before the text changes, so a late
    // answer cannot reappear against the edited text.
    if (pending) cancelInFlight();
    if (rendered || error) clearOutput();
    if (which === "rules") setRules(value);
    else setDraft(value);
  }

  function loadExample() {
    cancelInFlight();
    setRules(EXAMPLE_RULES);
    setDraft(EXAMPLE_DRAFT);
    // Bundled result, shown immediately. No fetch, no model call.
    setError(null);
    setCopyState("idle");
    setRendered({ kind: "saved", requirements: EXAMPLE_RESULT });
  }

  async function copyResults() {
    if (!rendered) return;
    const text = buildChecklist(rendered);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("clipboard unavailable");
      }
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 2400);
  }

  async function checkSubmission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const currentRules = rules;
    const currentDraft = draft;
    if (!currentRules.trim() || !currentDraft.trim()) {
      setRendered(null);
      setCopyState("idle");
      setError(
        "Both fields are needed. Paste the event rules and your draft submission, then try again.",
      );
      return;
    }

    const requestId = seq.current + 1;
    seq.current = requestId;
    const controller = new AbortController();
    inFlight.current = controller;

    setPending(true);
    setRendered(null);
    setError(null);
    setCopyState("idle");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: currentRules, draft: currentDraft }),
        signal: controller.signal,
      });

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (seq.current !== requestId) return;

      if (!response.ok) {
        setError(readError(response.status, body));
        return;
      }

      const requirements =
        body && typeof body === "object"
          ? (body as { requirements?: unknown }).requirements
          : undefined;
      if (!isRequirementList(requirements)) {
        setError("Error: the review came back in an unexpected shape. Please try again.");
        return;
      }

      setRendered({ kind: "live", requirements });
    } catch (caught) {
      if (seq.current !== requestId) return;
      const aborted = caught instanceof Error && caught.name === "AbortError";
      setError(
        aborted
          ? "The request was cancelled. Check your connection and try again."
          : "Could not reach the review service. Check your connection and try again.",
      );
    } finally {
      if (seq.current === requestId) {
        inFlight.current = null;
        setPending(false);
      }
    }
  }

  const counts = rendered
    ? {
        met: rendered.requirements.filter((item) => item.status === "met").length,
        missing: rendered.requirements.filter((item) => item.status === "missing").length,
        unclear: rendered.requirements.filter((item) => item.status === "unclear").length,
      }
    : null;

  return (
    <div className="review">
      <form onSubmit={checkSubmission} noValidate>
        <div className="field">
          <div className="field-head">
            <label htmlFor="rules">Event rules</label>
            <span
              className={`counter${rules.length >= COUNTER_WARN_AT ? " counter--warn" : ""}`}
              aria-hidden="true"
            >
              {rules.length.toLocaleString("en-US")} / {MAX_INPUT_CHARS.toLocaleString("en-US")}
            </span>
          </div>
          <textarea
            id="rules"
            name="rules"
            value={rules}
            maxLength={MAX_INPUT_CHARS}
            onChange={(event) => handleEdit("rules", event.target.value)}
            placeholder="Paste the hackathon rules, judging criteria, or submission checklist."
            rows={9}
            spellCheck={false}
            aria-describedby="privacy-note"
          />
        </div>

        <div className="field">
          <div className="field-head">
            <label htmlFor="draft">Draft submission</label>
            <span
              className={`counter${draft.length >= COUNTER_WARN_AT ? " counter--warn" : ""}`}
              aria-hidden="true"
            >
              {draft.length.toLocaleString("en-US")} / {MAX_INPUT_CHARS.toLocaleString("en-US")}
            </span>
          </div>
          <textarea
            id="draft"
            name="draft"
            value={draft}
            maxLength={MAX_INPUT_CHARS}
            onChange={(event) => handleEdit("draft", event.target.value)}
            placeholder="Paste your draft submission text: links, description, team details."
            rows={9}
            spellCheck={false}
            aria-describedby="privacy-note"
          />
        </div>

        <div className="actions">
          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Checking…" : "Check submission"}
          </button>
          <button type="button" className="secondary" onClick={loadExample}>
            Load example
          </button>
        </div>
        <p className="actions-note">
          <strong>Load example</strong> fills both fields and shows a saved result bundled with
          this page — it does not use the AI.
        </p>

        <div className="notice">
          <p className="notice-limits">
            This checks the text you paste. It does not verify links work or guarantee
            eligibility.
          </p>
          <p className="notice-privacy" id="privacy-note">
            Don't paste private or sensitive information. Pasted text is sent to an AI model
            (Google Gemini, free tier) to produce the review.
          </p>
        </div>
      </form>

      <div aria-live="polite" className="output">
        {pending ? (
          <div className="loading-block" role="status">
            <p className="loading">
              <span className="spinner" aria-hidden="true" />
              Reviewing your submission…
            </p>
            <div className="skeleton" aria-hidden="true">
              <span className="skeleton-bar" />
              <span className="skeleton-bar" />
              <span className="skeleton-bar skeleton-bar--short" />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="error" role="alert">
            <span className="error-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="6" cy="6" r="5" />
                <path d="M6 3.4v3.1M6 8.5v.2" />
              </svg>
            </span>
            <span>{error}</span>
          </div>
        ) : null}

        {rendered && counts ? (
          <section
            className="results"
            aria-label={
              rendered.kind === "saved" ? "Saved example — not a live review" : "Live review results"
            }
          >
            <div className="results-head">
              {rendered.kind === "saved" ? (
                <p className="saved-label">Saved example — not a live review</p>
              ) : (
                <p className="live-label">Live review</p>
              )}
              <button type="button" className="copy" onClick={copyResults}>
                {copyState === "copied" ? "Copied" : "Copy results"}
              </button>
            </div>

            {copyState !== "idle" ? (
              <p className="copy-status" role="status">
                {copyState === "copied"
                  ? "Copied — the checklist is on your clipboard."
                  : "Could not copy automatically. Select the results and copy them manually."}
              </p>
            ) : null}

            <p className="summary">
              {STATUS_ORDER.map((status, index) => (
                <span key={status} className={`summary-item summary-item--${status}`}>
                  <span className="summary-icon">
                    <StatusIcon status={status} />
                  </span>
                  <span className="summary-count">{counts[status]}</span>{" "}
                  {status}
                  {index < STATUS_ORDER.length - 1 ? (
                    <span className="summary-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                </span>
              ))}
            </p>

            {rendered.kind === "saved" ? (
              <p className="saved-note">
                This result ships with the page so it works without a model call. Edit either
                field, then press <strong>Check submission</strong> for a real review of your own
                text.
              </p>
            ) : null}

            <ul className="requirements">
              {rendered.requirements.map((item, index) => (
                <li key={`${item.requirement}-${index}`} className={`requirement req--${item.status}`}>
                  <div className="req-head">
                    <span className={`pill pill--${item.status}`}>
                      <StatusIcon status={item.status} />
                      {STATUS_LABEL[item.status]}
                    </span>
                    <h3 className="req-text">{item.requirement}</h3>
                  </div>
                  {item.quote ? (
                    <blockquote className="quote">
                      <span className="quote-mark" aria-hidden="true">
                        “
                      </span>
                      {item.quote}
                    </blockquote>
                  ) : null}
                  <p className="reason">{item.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

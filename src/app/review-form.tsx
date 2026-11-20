"use client";

import { useRef, useState } from "react";

import type { Requirement, Status } from "@/lib/agent";
import { EXAMPLE_DRAFT, EXAMPLE_RESULT, EXAMPLE_RULES } from "@/lib/example";
import { MAX_INPUT_CHARS } from "@/lib/limits";

type Rendered = { kind: "live" | "saved"; requirements: Requirement[] };

const STATUS_LABEL: Record<Status, string> = {
  met: "Met",
  missing: "Missing",
  unclear: "Unclear",
};

const STATUS_SYMBOL: Record<Status, string> = {
  met: "✓",
  missing: "✗",
  unclear: "?",
};

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

export default function ReviewForm() {
  const [rules, setRules] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Each submission gets a sequence number; a response that is not for the
  // latest submission is dropped, and editing bumps the sequence so an
  // in-flight response can never land on top of edited text.
  const seq = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

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
  }

  function handleEdit(which: "rules" | "draft", value: string) {
    // Abort/ignore any in-flight response before the text changes, so a late
    // answer cannot reappear against the edited text.
    if (pending) cancelInFlight();
    clearOutput();
    if (which === "rules") setRules(value);
    else setDraft(value);
  }

  function loadExample() {
    cancelInFlight();
    setRules(EXAMPLE_RULES);
    setDraft(EXAMPLE_DRAFT);
    // Bundled result, shown immediately. No fetch, no model call.
    setError(null);
    setRendered({ kind: "saved", requirements: EXAMPLE_RESULT });
  }

  async function checkSubmission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const currentRules = rules;
    const currentDraft = draft;
    if (!currentRules.trim() || !currentDraft.trim()) {
      setRendered(null);
      setError("Enter both the event rules and your draft submission, then try again.");
      return;
    }

    const requestId = seq.current + 1;
    seq.current = requestId;
    const controller = new AbortController();
    inFlight.current = controller;

    setPending(true);
    clearOutput();

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

  return (
    <div className="review">
      <form onSubmit={checkSubmission} noValidate>
        <div className="field">
          <label htmlFor="rules">
            Event rules
            <span className="counter" aria-hidden="true">
              {rules.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
            </span>
          </label>
          <textarea
            id="rules"
            name="rules"
            value={rules}
            maxLength={MAX_INPUT_CHARS}
            onChange={(event) => handleEdit("rules", event.target.value)}
            placeholder="Paste the hackathon rules or judging criteria."
            rows={10}
            spellCheck={false}
            aria-describedby="privacy-note"
          />
        </div>

        <div className="field">
          <label htmlFor="draft">
            Draft submission
            <span className="counter" aria-hidden="true">
              {draft.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}
            </span>
          </label>
          <textarea
            id="draft"
            name="draft"
            value={draft}
            maxLength={MAX_INPUT_CHARS}
            onChange={(event) => handleEdit("draft", event.target.value)}
            placeholder="Paste your draft submission text."
            rows={10}
            spellCheck={false}
            aria-describedby="privacy-note"
          />
        </div>

        <p className="privacy" id="privacy-note">
          Don't paste private or sensitive information. Pasted text is sent to
          an AI model (Google Gemini, free tier) to produce the review.
        </p>

        <div className="actions">
          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Checking…" : "Check submission"}
          </button>
          <button type="button" className="secondary" onClick={loadExample}>
            Load example
          </button>
        </div>
      </form>

      <div aria-live="polite" className="output">
        {pending ? (
          <p className="loading" role="status">
            <span className="spinner" aria-hidden="true" />
            Reviewing your submission…
          </p>
        ) : null}

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        {rendered ? (
          <section
            className="results"
            aria-labelledby="results-heading"
            aria-label={
              rendered.kind === "saved"
                ? "Saved example — not a live review"
                : "Live review results"
            }
          >
            <h2 id="results-heading">
              {rendered.kind === "saved" ? (
                <span className="saved-label">Saved example — not a live review</span>
              ) : (
                "Live review"
              )}
            </h2>
            {rendered.kind === "saved" ? (
              <p className="saved-note">
                This result ships with the page so it works without a model call.
                Edit either field, then press <strong>Check submission</strong> for a
                real review of your own text.
              </p>
            ) : null}

            <ul className="requirements">
              {rendered.requirements.map((item, index) => (
                <li key={`${item.requirement}-${index}`} className="requirement">
                  <p className="requirement-head">
                    <span className={`status-tag status-${item.status}`}>
                      <span aria-hidden="true">{STATUS_SYMBOL[item.status]}</span>{" "}
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="requirement-text">{item.requirement}</span>
                  </p>
                  <p className="reason">{item.reason}</p>
                  {item.quote ? (
                    <blockquote className="quote">{item.quote}</blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

import ReviewForm from "./review-form";

export default function Home() {
  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">Technical review tool</p>
        <h1>SubmitCheck</h1>
        <p className="hero-line">Catch missing hackathon requirements before you submit.</p>
        <ol className="steps">
          <li className="step">
            <span className="step-number" aria-hidden="true">
              1
            </span>
            <span className="step-body">
              <span className="step-title">Paste rules</span>
              <span className="step-sub">The event's requirements</span>
            </span>
          </li>
          <li className="step">
            <span className="step-number" aria-hidden="true">
              2
            </span>
            <span className="step-body">
              <span className="step-title">Paste draft</span>
              <span className="step-sub">What you plan to submit</span>
            </span>
          </li>
          <li className="step">
            <span className="step-number" aria-hidden="true">
              3
            </span>
            <span className="step-body">
              <span className="step-title">Get a checklist</span>
              <span className="step-sub">Every item quoted from your text</span>
            </span>
          </li>
        </ol>
      </header>

      <main>
        <ReviewForm />
      </main>

      <footer className="footer">
        <p className="footer-line">
          Code and issues:{" "}
          <a href="https://github.com/BeastkingX/submitcheck" target="_blank" rel="noreferrer">
            github.com/BeastkingX/submitcheck
          </a>
        </p>
        <p className="footer-line">
          API: <code>POST /api/agent</code>
        </p>
        <p className="footer-line footer-code">
          <span>
            in <code>{'{"rules": "...", "draft": "..."}'}</code>
          </span>
          <span>
            out <code>{'{"requirements": [{requirement, status, quote, reason}]}'}</code>
          </span>
        </p>
        <p className="footer-line">
          Example curl request in the{" "}
          <a href="https://github.com/BeastkingX/submitcheck#api" target="_blank" rel="noreferrer">
            README
          </a>
          .
        </p>
        <p className="footer-line footer-meta">
          Built for the Agent Games hackathon <span className="tag">#AgentGames</span>
        </p>
      </footer>
    </div>
  );
}

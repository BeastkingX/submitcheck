export default function Home() {
  return (
    <main>
      <h1>SubmitCheck</h1>
      <p className="tagline">
        Paste hackathon rules and a draft submission; get a review of what is
        met, missing, or unclear — with quotes from your own text.
      </p>

      <section className="card" aria-labelledby="status-heading">
        <h2 id="status-heading">Status</h2>
        <p className="status">
          <span className="badge">Not ready</span>
          <span>
            The review form is not wired up yet. The endpoint responds with{" "}
            <code>503</code> until live review is enabled.
          </span>
        </p>
      </section>

      <section aria-label="Limitations">
        <p className="limits">
          This checks the text you paste. It does not verify links work or
          guarantee eligibility.
        </p>
      </section>

      <p className="footnote">
        Public API: <code>POST /api/agent</code> accepting{" "}
        <code>{'{"rules": "...", "draft": "..."}'}</code>. Live review is not
        enabled in this build.
      </p>
    </main>
  );
}

import ReviewForm from "./review-form";

export default function Home() {
  return (
    <main>
      <h1>SubmitCheck</h1>
      <p className="tagline">
        Paste hackathon rules and a draft submission; get a review of what is met,
        missing, or unclear — with quotes from your own text.
      </p>

      <ReviewForm />

      <section aria-label="Limitations">
        <p className="limits">
          This checks the text you paste. It does not verify links work or
          guarantee eligibility.
        </p>
      </section>

      <p className="footnote">
        Public API: <code>POST /api/agent</code> accepting{" "}
        <code>{'{"rules": "...", "draft": "..."}'}</code>. It returns{" "}
        <code>{'{"requirements": [{requirement, status, quote, reason}]}'}</code>.
        See the README for a curl example.
      </p>
    </main>
  );
}

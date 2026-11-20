import type { Requirement } from "./agent.ts";

/**
 * The bundled saved example. It ships in the client bundle and never touches
 * the API: "Load example" fills both fields and shows this result instantly.
 *
 * Every non-null quote below appears verbatim in EXAMPLE_RULES or
 * EXAMPLE_DRAFT, and every `met` item quotes the draft. test/example.test.ts
 * enforces both rules, so an edit that breaks them fails `npm test`.
 */

export const EXAMPLE_RULES = `Orbit Hack 2026 — Submission Rules

1. Submit a working demo at a public HTTPS URL.
2. The demo must be usable without creating an account.
3. Provide a public HTTPS agent endpoint that returns JSON, and link it from your submission page.
4. Include a 2-3 minute video walkthrough linked from the submission.
5. List every team member and their role in the submission.
6. State which zkVerify network you used (testnet or mainnet).

Optional: bonus points for an open-source repository. Blog posts are welcome but not required.`;

export const EXAMPLE_DRAFT = `Team: Two of us — Ada (circuits), Bo (frontend).

Demo: https://orbit-demo.example.com
A proof-of-inclusion checker built on zkVerify testnet. Opens without an account.

Video walkthrough: https://youtu.be/example-orbit (2:40)

What it does: paste a Merkle proof, verify it against zkVerify, and see the result.
Repository: https://github.com/example/orbit-check`;

export const EXAMPLE_RESULT: Requirement[] = [
  {
    requirement: "Submit a working demo at a public HTTPS URL",
    status: "met",
    quote: "Demo: https://orbit-demo.example.com",
    reason: "The draft links a public HTTPS demo.",
  },
  {
    requirement: "The demo is usable without creating an account",
    status: "met",
    quote: "Opens without an account.",
    reason: "The draft says the demo opens without an account.",
  },
  {
    requirement:
      "Provide a public HTTPS agent endpoint that returns JSON, and link it from the submission page",
    status: "missing",
    quote:
      "Provide a public HTTPS agent endpoint that returns JSON, and link it from your submission page.",
    reason:
      "The draft lists a demo page, a video, and a repository, but no agent endpoint.",
  },
  {
    requirement: "Include a 2-3 minute video walkthrough linked from the submission",
    status: "met",
    quote: "Video walkthrough: https://youtu.be/example-orbit (2:40)",
    reason: "The draft links a 2:40 walkthrough.",
  },
  {
    requirement: "List every team member and their role",
    status: "unclear",
    quote: "Team: Two of us — Ada (circuits), Bo (frontend).",
    reason: "Two names are given with very short role hints; check the roles are clear.",
  },
  {
    requirement: "State which zkVerify network you used (testnet or mainnet)",
    status: "met",
    quote: "zkVerify testnet",
    reason: "The draft names the network it used.",
  },
];

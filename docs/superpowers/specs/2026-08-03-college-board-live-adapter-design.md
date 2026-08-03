# College Board Live Question Bank Adapter — Design Amendment

This amendment supersedes the bundled-question portions of `2026-08-03-sat-practice-loop-design.md`. The visual direction, practice/review/memory loop, optional AI boundary, and accessibility requirements remain in force.

## Source boundary

The practice bank comes from College Board's currently public SAT Suite Question Bank services:

```text
GET  https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/lookup
POST https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions
POST https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question
GET  https://saic.collegeboard.org/disclosed/{ibn}.json
```

SAT assessment id is `99`; Reading & Writing test id is `1` with domains `INI,CAS,EOI,SEC`; Math test id is `2` with domains `H,P,Q,S`.

The client loads lookup plus the two metadata lists on startup. It builds a released-question catalog, drops every record whose nonempty `external_id` appears in the appropriate lookup live-item set, and stores the catalog only in memory. It fetches one detail record when that question becomes current. Standard records use `external_id`; legacy records use the disclosed `ibn` URL. No question HTML, choices, answer keys, rationales, or bulk metadata are written to localStorage.

The service is undocumented and may change. The app must show a recoverable connection error and a retry action if lookup, listing, detail, or response validation fails. It must identify the source as College Board and state that the connection is live/unofficial.

## Data model

```ts
type QuestionMeta = {
  id: string; // external_id, or `ibn:${ibn}`
  externalId?: string;
  ibn?: string;
  section: "reading-writing" | "math";
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: "easy" | "medium" | "hard";
};

type QuestionDetail = QuestionMeta & {
  kind: "multiple-choice" | "student-produced-response";
  stimulusHtml: string;
  promptHtml: string;
  choices: Array<{ id: string; label: string; html: string }>;
  correctAnswers: string[];
  rationaleHtml: string;
};

type Attempt = {
  id: string;
  questionId: string;
  response: string;
  correct: boolean;
  createdAt: string;
};
```

Persistence schema becomes version `2`. Hydration rejects version 1, malformed attempts, orphaned question ids, duplicate attempt ids, and invalid response fields. It replays validated attempts to rebuild unresolved and ever-missed sets. Since answer keys are intentionally not bulk-fetched or stored, persisted `correct` is structurally validated rather than recomputed at startup; this affects only the local user's own statistics.

## Rendering and grading

College Board detail fields contain HTML, MathML, tables, and legacy embedded images. Every HTML fragment is sanitized with DOMPurify immediately before `dangerouslySetInnerHTML`; no raw service string is injected. Model prompts receive plain text derived from sanitized content, never markup or base64 images.

Multiple-choice answers are graded against `correct_answer` labels when available and answer-option key ids as a defensive fallback. Student-produced responses use a text field and compare a trimmed, comma-free, Unicode-minus-normalized response against the returned accepted answers; numerically equivalent finite values compare equal. The exact accepted answer is revealed after submission.

## Interaction changes

- Startup shows a catalog-loading state, then the live eligible count.
- Filters include subject, domain, skill, difficulty, and unresolved-misses mode, with intersection semantics.
- Changing filters or moving next aborts stale detail and coach requests.
- Detail loading and detail errors live inside the practice surface without losing filters or saved progress.
- Review and Memory derive labels from metadata, so they do not fetch question details.
- Retry mode fetches the unresolved question detail on demand.
- Reset clears only local attempt memory.

## Verification

Contract tests use recorded minimal fixtures, never the live network. A separate opt-in/live smoke command may verify current endpoint compatibility. Browser QA uses the live service and covers a standard MCQ, a legacy IBN item, a student-produced response when encountered, filters, persistence, retries, sanitized rich content, failure recovery, desktop, and mobile.


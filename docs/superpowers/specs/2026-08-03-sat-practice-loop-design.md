# SAT Practice Loop — Product and Design Spec

## Product job

Build a local-first SAT question-bank experience for one student who wants to move quickly through original practice questions, remember weak topics, and revisit unresolved misses. The primary loop is filter → answer → understand → continue. There is no account system, social layer, or content-authoring UI.

## Scope

- 24 original SAT-style multiple-choice questions split evenly across Reading & Writing and Math.
- Filters for subject, domain, difficulty, and practice mode (all questions or unresolved misses).
- One-question-at-a-time practice with keyboard-accessible answers, immediate correctness feedback, a concise explanation, and a next-question action.
- Persistent attempt history, unresolved retry queue, ever-missed history, per-domain accuracy, and recent activity.
- An optional AI coach summary after an incorrect answer or on demand. Correctness never depends on AI.
- A deterministic local coaching fallback when no API key is configured, the network fails, or the response is invalid.
- Reset-progress control with explicit confirmation.

Out of scope: official College Board content, timed full-length tests, accounts/cloud sync, score prediction, payments, question editing, and production deployment.

## Architecture

The client is a React + TypeScript single-page app built with Vite. A small Express server runs Vite in middleware mode during development, serves the production build, and exposes `POST /api/explain`. Domain logic is split into pure modules so it is independently testable:

- `questions.ts`: immutable original question content and content types.
- `practice.ts`: filtering, next-question selection, progress derivation, and idempotent attempt recording.
- `storage.ts`: one versioned localStorage document with validation, deduplication, and safe fallback.
- `coach.ts`: local explanation composition and client API request handling.
- React components: navigation, practice card, filters, memory trace, history/review view, and feedback.
- `server/index.ts`: static/development serving plus the optional OpenAI Responses API call.

The persisted record is one atomic document:

```ts
type PracticeState = {
  version: 1;
  attempts: Array<{
    id: string;
    questionId: string;
    selectedIndex: number;
    correct: boolean;
    createdAt: string;
  }>;
  unresolvedIds: string[];
  missedHistoryIds: string[];
};
```

`recordAttempt` ignores an already-seen attempt id. A wrong answer adds the question id to both missed arrays with set semantics. A correct answer removes it from `unresolvedIds` but never from `missedHistoryIds`. Stats derive from attempts; no duplicated counters are persisted.

## AI coach boundary

The browser sends only the current question, its answer options, selected answer, correct answer, topic, and built-in rationale to `/api/explain`. The server reads `OPENAI_API_KEY`; it is never sent to or stored by the browser. The server calls the Responses API with a short, non-streaming prompt and extracts `output_text`. `OPENAI_MODEL` can override the default `gpt-5.6-luna` model.

If the key is absent or any request fails, the endpoint reports an unavailable state and the client immediately displays a deterministic local recap. Requests are abortable; a late answer is ignored after navigation. Model text is rendered as plain text. AI output is supplementary and cannot change the recorded result.

## Interaction model

The app opens directly into Practice. The header exposes Practice, Review, and Memory. A compact filter row sits above the question card. Selecting an answer enables Check answer. Submission locks all choices and announces the result through a live region. Wrong answers automatically reveal the coach recap; any answered question exposes “Ask coach.” Next advances within the active pool without repeating the current question when another eligible question exists.

Review shows unresolved misses first, followed by ever-missed history. Memory shows domain rows with attempted count, percentage accuracy, and a short status label. Filters have intersection semantics. Empty filtered or retry pools show a clear recovery action.

## Visual direction

Subject: a focused high-school student doing short, repeatable SAT drills. The page’s single job is to keep the next useful question obvious while making accumulated learning visible.

Palette:

- Ink — `#172033`
- Paper — `#F6F8FC`
- Electric blue — `#5667FF`
- Highlighter — `#E9FF70`
- Correct — `#168C69`
- Incorrect — `#D7535D`

Type uses `Avenir Next`/`Inter`-style sans for reading, `Georgia` sparingly for the question stem/passage, and `SFMono-Regular` for tiny labels and data. No remote font request is required.

Layout at desktop:

```text
┌ logo / practice / review / memory ───────── streak / reset ┐
├ filters ────────────────────────────────────────────────────┤
│ passage or prompt      │ question + answers                 │
│                        │ feedback / coach                    │
├────────────────────────┴───────────────────┬────────────────┤
│ queue context                              │ memory trace   │
└────────────────────────────────────────────┴────────────────┘
```

On mobile, filters horizontally scroll, passage and question stack, and the memory trace becomes a compact bottom summary.

Signature element: the “memory trace,” a vertical sequence of topic strips whose fill and small dot pattern encode current accuracy and attempt volume. It updates immediately after every answer, making persistence visible without turning the product into a generic dashboard.

Motion is limited to one answer-check transition and the memory-trace fill. Reduced-motion disables both.

## Error handling and accessibility

- Invalid, missing, outdated, duplicated, or orphaned persisted data is normalized or reset without crashing.
- Storage access and quota errors fall back to in-memory state.
- Empty pools never dereference an undefined question.
- Option groups use native radios; feedback is not conveyed by color alone.
- Focus is visible, touch targets are at least 44 px, live feedback uses `role="status"`, and the layout avoids horizontal page scrolling at 320 px and 200% zoom.
- AI failures do not block feedback or navigation.

## Acceptance bar

Automated tests cover pure filtering, idempotent recording, retry resolution, stats, storage validation, and coach fallback. A production build must succeed. Browser QA covers fresh use, wrong/correct flows, reload persistence, retry flow, AI fallback, review/memory views, keyboard navigation, and responsive layouts.


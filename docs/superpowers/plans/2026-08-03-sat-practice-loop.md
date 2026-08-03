# SAT Practice Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, local-first SAT practice web app with persistent mistake memory and optional AI coaching.

**Architecture:** React renders a one-question practice loop over immutable local content. Pure domain modules own filtering, attempt transitions, statistics, storage validation, and explanation fallback; a small Express/Vite server owns the optional OpenAI call so no key reaches the browser.

**Tech Stack:** React 19, TypeScript, Vite, Express, Vitest, Testing Library, CSS.

## Global Constraints

- Use only original SAT-style content; do not reproduce official College Board questions.
- Persist one versioned state document in localStorage and treat it as untrusted input.
- Correctness is local and deterministic; AI never grades an answer.
- Keep `OPENAI_API_KEY` server-side and make AI strictly optional.
- Render model output as plain text and ignore stale requests after navigation.
- Support 320 px layouts, keyboard use, visible focus, native radio semantics, reduced motion, and non-color feedback.

---

### Task 1: Project skeleton and domain contracts

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example`
- Create: `src/types.ts`, `src/test/setup.ts`

**Interfaces:**
- Produces: `Question`, `Attempt`, `PracticeState`, `Filters`, and view-mode types used by later tasks.

- [ ] Write a smoke test that imports the shared contracts and verifies the initial state shape through a public initializer.
- [ ] Run the focused test and confirm it fails because the initializer is missing.
- [ ] Add the smallest Vite/React/Vitest scaffold and shared types needed to pass.
- [ ] Run the focused test and full test suite.

### Task 2: Practice state engine and persistence

**Files:**
- Create: `src/lib/practice.test.ts`, `src/lib/practice.ts`
- Create: `src/lib/storage.test.ts`, `src/lib/storage.ts`

**Interfaces:**
- Consumes: `Question`, `Attempt`, `PracticeState`, `Filters`.
- Produces: `initialPracticeState()`, `filterQuestions()`, `recordAttempt()`, `deriveTopicStats()`, `loadPracticeState()`, and `savePracticeState()`.

- [ ] Add failing behavior tests for intersection filters, empty pools, idempotent attempt ids, wrong-answer queue insertion, correct retry resolution, missed-history retention, untouched-topic stats, duplicate/orphan hydration, invalid JSON, and storage exceptions.
- [ ] Run the focused tests and verify each failure names a missing behavior.
- [ ] Implement pure state transitions and one versioned storage adapter with validation/deduplication.
- [ ] Run the focused tests and full test suite.

### Task 3: Original question bank

**Files:**
- Create: `src/data/questions.ts`

**Interfaces:**
- Produces: `questions: Question[]` with stable ids, subject/domain/skill/difficulty metadata, four choices, answer index, and rationale.

- [ ] Add 24 original questions: 12 Reading & Writing and 12 Math, distributed across multiple SAT domains and difficulties.
- [ ] Validate each question has four nonempty options, a valid answer index, unique id, and nonempty explanation with a data test.
- [ ] Run the data test.

### Task 4: Coach boundary

**Files:**
- Create: `src/lib/coach.test.ts`, `src/lib/coach.ts`
- Create: `server/coach.test.ts`, `server/coach.ts`, `server/index.ts`

**Interfaces:**
- Produces: `localCoachSummary(question, selectedIndex)`, `requestCoachSummary(payload, signal)`, and the `POST /api/explain` handler.

- [ ] Add failing tests for deterministic fallback, missing-key response, non-2xx/malformed output, and extraction of `output_text` from a valid Responses API payload.
- [ ] Run the focused tests and verify expected failures.
- [ ] Implement an abortable client request plus a server-only `fetch` call to `/v1/responses`, defaulting to `gpt-5.6-luna` with concise instructions.
- [ ] Run the focused tests and full test suite.

### Task 5: Practice UI and memory views

**Files:**
- Create: `src/main.tsx`, `src/App.test.tsx`, `src/App.tsx`
- Create: `src/components/PracticeView.tsx`, `src/components/MemoryTrace.tsx`, `src/components/ReviewView.tsx`, `src/components/FilterBar.tsx`, `src/components/CoachPanel.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: the question bank, practice engine, storage adapter, and coach client.
- Produces: a complete Practice/Review/Memory single-page interface.

- [ ] Add failing interaction tests for disabled submit, one attempt per submission, locked choices, wrong-answer feedback, retry resolution, and an empty filtered pool.
- [ ] Run tests and verify they fail for missing UI behavior.
- [ ] Implement the shell, filters, two-column practice card, feedback, abort-safe coach panel, review list, memory trace, reset confirmation, keyboard focus, and responsive states.
- [ ] Run component tests and full tests.

### Task 6: Integration and visual verification

**Files:**
- Create: `README.md`
- Modify: files from prior tasks only for issues proven by verification.

**Interfaces:**
- Consumes: the full app.
- Produces: setup/run documentation and browser-verified prototype.

- [ ] Run `npm test -- --run`, `npm run build`, and `npm run typecheck`.
- [ ] Start the app and verify practice, wrong/correct, retry, persistence, filters, review, memory, reset, and local coach fallback in the browser.
- [ ] Inspect desktop and 320 px screenshots, keyboard focus, and console errors; fix only observed defects and add regression tests for behavior defects.
- [ ] Re-run the full verification commands after the final fix.


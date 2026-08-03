# College Board Live Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bundled fake question bank with College Board's live released-question catalog and on-demand details while preserving the practice, memory, retry, and coach experience.

**Architecture:** A client adapter validates lookup, metadata, standard details, and legacy disclosed details into one internal model. App state holds catalog metadata and one current detail; localStorage holds only versioned attempts and question ids. Rich HTML is sanitized at render time.

**Tech Stack:** React, TypeScript, fetch, DOMPurify, Vitest, Testing Library.

## Global Constraints

- Never bundle, bulk-cache, or persist College Board question content.
- Exclude live-item ids from lookup defensively on every catalog load.
- Support standard `external_id` and legacy nonempty `ibn` records.
- Support multiple-choice and student-produced-response questions.
- Sanitize all service HTML before rendering and send only plain text to AI.
- Make every network failure recoverable and abort stale requests.
- Keep correctness local; AI never grades.

### Task 1: Live adapter contracts

**Files:** `src/types.ts`, `src/lib/qbank.test.ts`, `src/lib/qbank.ts`

- [ ] Add failing fixture tests for catalog loading, live exclusion, blank-id handling, standard detail normalization, legacy detail normalization, MCQ grading, SPR grading, malformed responses, non-2xx errors, and abort propagation.
- [ ] Implement the smallest adapter and shared types that pass.
- [ ] Run focused tests and typecheck.

### Task 2: Version 2 persistence and stats

**Files:** `src/lib/practice.test.ts`, `src/lib/practice.ts`, `src/lib/storage.test.ts`, `src/lib/storage.ts`

- [ ] Rewrite failing tests around metadata filtering, response attempts, version-1 reset, replayed retry/history, and topic stats.
- [ ] Implement metadata-based practice transitions and schema version 2.
- [ ] Run focused tests and typecheck.

### Task 3: Sanitized rich question UI

**Files:** `package.json`, `src/components/RichHtml.test.tsx`, `src/components/RichHtml.tsx`, `src/components/PracticeView.tsx`, `src/components/FilterBar.tsx`

- [ ] Add DOMPurify and failing rendering tests for HTML/MathML plus script/event/url removal.
- [ ] Support MCQ radio and SPR text response surfaces, loading/error/retry states, skill filtering, and source attribution.
- [ ] Run focused tests and typecheck.

### Task 4: App integration, review, memory, and coach

**Files:** `src/App.test.tsx`, `src/App.tsx`, `src/components/ReviewView.tsx`, `src/components/MemoryTrace.tsx`, `src/components/CoachPanel.tsx`, `src/lib/coach.test.ts`, `src/lib/coach.ts`, `src/styles.css`

- [ ] Replace bundled-data tests with mocked live-adapter interaction tests.
- [ ] Load the catalog asynchronously, fetch/abort details on demand, persist only attempts, and derive review/memory from metadata.
- [ ] Convert sanitized question context to plain text for coach summaries.
- [ ] Run component/full tests, typecheck, and build.

### Task 5: Live and visual QA

**Files:** `README.md`; production files only for defects proven during QA.

- [ ] Document the public undocumented dependency, network exposure, run steps, and AI option.
- [ ] Run all tests, typecheck, and production build.
- [ ] Run a live endpoint smoke check and browser-test MCQ, legacy, filters, miss/retry, reload persistence, coach fallback, desktop, and mobile.


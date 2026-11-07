# Shuffle detail failures

- User report: "When I shuffle every other question fails to fetch".
- Live College Board check: the legacy disclosed item `070615-DC` returns `answer.style = SPR` and no `answer.correct_choice`; this cannot be graded and previously threw a generic invalid-response error. Sampled 30 legacy Math items: 4 had no answer key. The live list had 3,770 records, of which 459 were legacy-only at check time.
- Fix: distinguish ungradable details with no answer key, remove those IDs from the in-session queue on current or lookahead fetch, and retry one transient network/429/5xx current-detail failure after 400 ms. No attempt/progress is recorded for skipped items. Nontransient errors retain the existing Retry UI.
- Claude brainstorming/review session: `423eca9e-c46e-4026-a144-e6f71c524167`. Prompt 1 requested read-only root-cause analysis of `App.tsx` and `qbank.ts`; Claude found no deterministic shuffle race and suggested legacy host/payload and burst-request causes. Prompt 2 requested read-only review of the uncommitted fix; Claude flagged incomplete key classification and effect-dependency restarts; both were addressed. It also noted that persistent CORS failures would still surface after one retry.
- Local evidence: `npm test -- --run` 8 files/96 tests passed, `npm run build` passed, `git diff --check` passed. Local browser QA unavailable because Work settings disable local browser use.
- Existing user `.gitignore` modification was not staged or changed.

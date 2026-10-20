# History navigation handoff — 2026-10-20

## Scope

Back navigates saved attempts (including those from earlier sessions) without reopening them for grading. On past attempts, Hide answers removes the selected response, correct/wrong marks, accepted answer, and rationale. Forward returns to the unfinished live question; its draft and elapsed time are retained. No new question content is persisted.

## Claude collaboration

Provider: Claude Code CLI using the existing subscription. Persistent read-only conversation ID: `423eca9e-c46e-4026-a144-e6f71c524167`. No Claude edits or execution tasks were delegated.

Initial prompt: “Read-only design review for /Users/niranjanj/Desktop/sat. User wants Back to past practice questions, immutable answers, and hide/reveal selected/correct/wrong markings on past questions, then push. Inspect App.tsx, PracticeView.tsx, tests. Propose the smallest safe state model and edge cases. Do not edit files. Keep response concise.”

Initial result: Saved `Attempt` already contains the necessary answer data; history must be managed in App because PracticeView remounts per question. Claude called out duplicate attempts, account changes, filter changes, missing catalog metadata, and the lookahead/detail race. We chose attempt-ID-based all-time history and per-question ephemeral Hide answers.

Review prompt: “Review the uncommitted Back/read-only history and Hide answers implementation for correctness, data loss, security, and UX regressions. Inspect changed files and connected code. Do not edit files. Give only actionable findings with severity and file/line.”

Review result: No security issue or push blocker. Claude found that backing out of an unfinished question lost stopwatch time; fixed by carrying elapsed time with its draft. It also noted smaller issues: stale history cursor after an external reset, old attempts without timer data, ambiguous `aria-pressed`, and missing Back during detail-load errors. The old-timer and `aria-pressed` issues were fixed. Claude could not run tests because its shell permission was denied; Codex ran them independently.

## Verification evidence

`npm test -- --run`: 8 test files passed, 85 tests passed (2026-10-20 11:50 local).

`npm run typecheck`: `tsc -b --pretty false` exited 0.

`npm run build`: Vite v8.2.0 built successfully; main JS 264.14 kB, CSS 23.72 kB.

`git diff --check`: exited 0.

Browser plugin was unavailable, so an ephemeral Playwright installation drove Chrome against `http://127.0.0.1:5173/`. Live College Board question flow: answer → Next → Back → Hide answers → Next. Observed zero checked radios and no accepted-answer text in hidden mode; Show answers restored one checked radio and accepted-answer text. No page errors. On a second pass the live stopwatch read `00:02` before Back and `00:02` after returning; hidden selection count was 0 and page errors were empty. Desktop and 390px mobile screenshots are outside the repo at `/tmp/sat-history-hidden-settled.png`, `/tmp/sat-history-shown.png`, and `/tmp/sat-history-mobile-fixed.png`. Mobile document width equaled its 390px viewport.

The pre-existing unrelated `.gitignore` edit was left unstaged.

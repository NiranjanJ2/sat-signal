# College Board underline rendering — 2026-10-21

Request: fix a Cross-Text Connections item whose stem refers to an underlined portion that the app rendered without an underline.

Source evidence: College Board metadata `questionId=f3c45b4f`, `external_id=1654cd84-f39b-43db-80e8-cf0e6d4b9926`. The live detail's `stimulus` marks the target sentence as `<span style="text-decoration: underline;">…</span>`. `RichHtml.tsx` intentionally strips all inline styles; no equivalent underline was being applied.

Change: while stripping inline styles, the sanitizer now maps only HTML `text-decoration: underline` or `text-decoration-line: underline` to the fixed `.rich-underline` class. Later decoration declarations override earlier ones. Other inline styles remain forbidden. CSS supplies the underline. Unit test covers the live item's markup shape, unsafe extra styles, `none`, `text-decoration-line`, and native `<u>`.

Claude collaboration: resumed the existing Claude Sonnet 5.5 review session `423eca9e-c46e-4026-a144-e6f71c524167` using `/Users/niranjanj/.local/bin/claude -p --resume ... --allowedTools Read,Grep,Glob --output-format json`. Prompt: “Read-only review: SAT question bank app at /Users/niranjanj/Desktop/sat. User screenshot shows a Cross-Text Connections item (College Board ID f3c45b4f) whose question refers to underlined text, but underline is invisible. Inspect RichHtml.tsx, styles.css, qbank parsing. Do not edit files. Identify likely root cause, narrow safe fix, tests and risks. Return concise.” Claude identified sanitizer style stripping, recommended safe fixed-class translation and tests, and made no edits. Its report noted that it had not fetched the live detail; Codex independently fetched and confirmed the actual markup.

Verification: `npm test -- --run` passed 8 files / 88 tests; `npm run build` passed; `git diff --check` passed. Browser plugin was unavailable, so Playwright used installed Chrome against local Vite at `http://127.0.0.1:5173/`, with only this released College Board item in an isolated test catalog. The DOM had exactly one `.passage-content .rich-underline`, its text was the intended sentence, computed `textDecorationLine` was `underline`, the inline `style` attribute was absent, and there were zero page errors. Screenshot: `/tmp/sat-underline-after.png`.

Working tree: `.gitignore` was modified before this task and was left untouched. The underline fix is being committed and pushed at the user's request; deployment was not separately verified.

# Full answer-row selection

- Request: clicking the middle/background of a multiple-choice answer bar should select that answer and publish publicly.
- Change: direct clicks on answer-row background use the existing radio selection path. Label/radio clicks remain native, cross-out stays separate, submitted and past answers stay read-only.
- Claude review conversation: `423eca9e-c46e-4026-a144-e6f71c524167`. Prompt asked for read-only diff/nearby-code review of row selection, cross-out, past answers and accessibility. Claude confirmed no data-loss issue or double firing; noted existing arrow-key cross-out behavior and low-impact text-drag edge case. No execution delegation was needed for the focused two-file UI change.
- Verification: `npm test -- --run` (8 files, 97 tests passed before final read-only assertion), `npm run build` passed, `git diff --check` passed. The final read-only assertion was added after Claude review and rerun before publish.
- Existing user `.gitignore` change left untouched.

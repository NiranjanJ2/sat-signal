# Correct-answer streak design

## Goal

Replace the calendar-day streak in the header with a persistent consecutive-correct streak. The indicator uses one fire emoji whose visual heat increases with the streak.

## Behavior

- A correct answer in **New questions** increments the streak.
- A wrong answer in **New questions** resets the streak to zero.
- Attempts made in **Practice misses** are ignored: they neither increment nor reset the streak.
- Resetting progress clears the streak because it clears attempt history.
- Removing an attempt from the progress JSON automatically changes the derived streak.
- Existing attempts without a recorded practice mode are treated as New questions for backward compatibility.

## Persistence and data flow

Each newly saved attempt records whether it came from `all` (New questions) or `missed` (Practice misses). This field is optional in the version 2 JSON schema so existing progress remains readable. Browser and server normalization must preserve it.

The streak is derived from the chronological attempt log rather than stored separately. Starting from the newest attempt, ignore Practice Misses records, count consecutive correct New questions records, and stop at the first wrong New questions record. This avoids duplicated state and keeps the header consistent after reboot, sync, reset, or targeted record removal.

## Header treatment

Replace `N day streak` with `🔥 N correct streak`. Keep a single emoji and apply a heat tier from the derived count:

- `0`: dim and desaturated
- `1–2`: normal fire
- `3–4`: brighter with a small warm glow
- `5–9`: larger orange/red glow
- `10+`: hottest glow with a subtle pulse

The hottest tier respects `prefers-reduced-motion` and remains static when reduced motion is enabled. The text stays readable and compact at mobile widths.

## Failure handling

Malformed or unknown practice-mode values are rejected by server input validation. Older attempts with no mode remain valid. A failed progress save follows the app's existing reconciliation path; the visible streak is recalculated from the reconciled attempt list.

## Tests

- Pure streak calculation: increment, reset, ignore Practice Misses, and backward-compatible old attempts.
- Progress normalization and server persistence preserve a valid practice mode and reject an invalid one.
- Submission records the active queue mode.
- Header replaces the day label and exposes the correct heat tier.
- Existing reset and stale-generation behavior remain green.


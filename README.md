# SAT Signal — live SAT practice

SAT Signal is a browser-local practice loop over College Board's live SAT Question Bank. Filter by section, domain, skill, and difficulty; answer one problem at a time; retry unresolved misses; and watch topic accuracy accumulate in a persistent memory trace.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. There is no server and no account: the browser fetches released-question metadata directly from College Board, excludes IDs in the service's current live-item lists, and keeps only the open question plus a small in-memory lookahead cache.

## How progress is stored

Everything lives in `localStorage` under `sat-practice-state`, so each visitor has their own history and nothing is shared between them. The default queue contains only questions that browser has never attempted, so returning to the site never repeats a question you have already seen; unresolved mistakes stay available under **Practice misses**.

The stored document holds only question IDs, responses, correctness, timestamps, and a reset generation — question text, choices, rationales, and answer keys are never persisted. Two tabs of the same browser share one key, so a save merges with whatever the other tab wrote instead of overwriting it, and a bumped generation from a reset in another tab stops a stale tab from resurrecting erased history.

Consequences worth knowing: progress does not follow you to another browser or device, and clearing site data erases it with no recovery. There is no server-side copy.

Because this is an unofficial integration with an undocumented service, the endpoint can change without notice. Requests expose normal connection metadata such as your IP address and browser user agent to College Board.

## Deploy

Static build, no functions, no environment variables:

```bash
npm run build   # emits dist/
```

Vercel auto-detects the Vite preset. Any static host works.

## Verify it

```bash
npm test -- --run
npm run typecheck
npm run build
```

For endpoint-contract references, see the [unofficial OpenAPI specification](https://github.com/NanamiNakano/ssqb-docs/blob/main/OpenAPI.yaml), a [TypeScript client](https://github.com/ElijahFeldman7/sat/blob/main/lib/qbank/client.ts), and a [College Board importer](https://github.com/MoBamba106/SATQuestionBank/blob/main/scripts/cb-import.ts).

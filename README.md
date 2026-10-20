# SAT Signal — live SAT practice

SAT Signal is a practice loop over College Board's live SAT Question Bank. Filter by section, domain, skill, and difficulty; answer one problem at a time; retry unresolved misses; and watch topic accuracy accumulate in a persistent memory trace. Each question has a stopwatch that stops when you check your answer. Back opens saved attempts read-only; Hide answers conceals the selection and verdict until you reveal them.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. The browser fetches released-question metadata directly from College Board, excludes IDs in the service's current live-item lists, and keeps only the open question plus a small in-memory lookahead cache. Without the optional Firebase configuration below, progress stays in this browser.

## How progress is stored

Guest progress lives in `localStorage` under `sat-practice-state`. Signed-in progress has a separate browser key for each Google account and syncs to that account's Firestore document. When you first sign in, guest progress joins the account history. The default queue contains only questions that account has never attempted; unresolved mistakes stay available under **Practice misses**.

The stored document holds only question IDs, responses, correctness, timestamps, elapsed time, and a reset generation — question text, choices, rationales, and answer keys are never persisted. Concurrent account saves merge attempts; a newer reset generation prevents stale history from reappearing.

Guest progress does not follow you to another browser or device. Signed-in progress does, once the header says **Synced**. If sync is paused, the browser copy remains available and the header offers **Retry**.

## Google sign-in setup

Create a Firebase project, register a Web app, enable **Authentication → Sign-in method → Google**, and create a **Cloud Firestore** database. Publish [firestore.rules](firestore.rules) as its security rules. Add your local and deployed hostnames under **Authentication → Settings → Authorized domains**.

Copy `.env.example` to `.env` and fill the four public Web app configuration values from Firebase project settings. Restart Vite. For a deployed build, set the same `VITE_FIREBASE_*` values in the host's build environment. The Google button appears when all four values are present. These values identify the Firebase project; Firestore rules protect each user's progress. No service-account key belongs in the frontend.

Because this is an unofficial integration with an undocumented service, the endpoint can change without notice. Requests expose normal connection metadata such as your IP address and browser user agent to College Board.

## Deploy

Static build, no functions. The four Firebase build variables are needed only for Google sync:

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

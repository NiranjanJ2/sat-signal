# SAT Signal — live SAT practice

SAT Signal is a local-first practice loop over College Board's live SAT Question Bank. Filter by section, domain, skill, and difficulty; answer one problem at a time; retry unresolved misses; and watch topic accuracy accumulate in a persistent memory trace.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Progress is saved in this browser with localStorage; no account is required.

The browser loads released-question metadata directly from College Board, excludes IDs in the service's current live-item lists, and fetches one question's detail only when you open it. Question text, choices, rationales, and answer keys are not bundled or written to localStorage. Because this is an unofficial integration with an undocumented service, the endpoint can change without notice. Direct requests expose normal connection metadata such as your IP address and browser user agent to College Board.

## Optional AI coach

The built-in coach works without an OpenAI request. To replace its deterministic recap with a generated summary, copy `.env.example` to `.env` and set a server-side OpenAI API key:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
```

The key is read only by the local Express server and is never included in browser code or saved practice data. A coach request sends sanitized plain text for the current question, choices, response, accepted answer, topic, and College Board rationale to the configured model. It never sends the service's raw HTML or embedded image data. Any non-abort API failure falls back to a local recap.

The server intentionally binds to `127.0.0.1` for personal use. If you later place it behind a public reverse proxy, add authentication and rate limiting before enabling `OPENAI_API_KEY`; otherwise the coach endpoint could be used against your API quota.

## Verify it

```bash
npm test -- --run
npm run typecheck
npm run build
```

For endpoint-contract references, see the [unofficial OpenAPI specification](https://github.com/NanamiNakano/ssqb-docs/blob/main/OpenAPI.yaml), a [TypeScript client](https://github.com/ElijahFeldman7/sat/blob/main/lib/qbank/client.ts), and a [College Board importer](https://github.com/MoBamba106/SATQuestionBank/blob/main/scripts/cb-import.ts).

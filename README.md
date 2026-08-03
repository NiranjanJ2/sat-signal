# Trace — SAT practice

Trace is a local-first SAT practice loop: filter an original question bank, answer one problem at a time, retry unresolved misses, and watch topic accuracy accumulate in a persistent memory trace.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Progress is saved in this browser with localStorage; no account is required.

## Optional AI coach

The built-in coach works without a network request. To replace its deterministic recap with a generated summary, copy `.env.example` to `.env` and set a server-side OpenAI API key:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
```

The key is read only by the local Express server and is never included in browser code or saved practice data. A coach request sends the current question, answer choices, selected answer, correct answer, topic, and built-in rationale to the configured model. Any API failure falls back to the local recap.

## Verify it

```bash
npm test -- --run
npm run typecheck
npm run build
```

The 24 included questions are original SAT-style practice items, not official College Board questions.


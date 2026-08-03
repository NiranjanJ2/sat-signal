import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoachApiPayload } from "../src/lib/coach-contract";
import type { GenerateCoachOptions } from "./coach";
import { createApiApp } from "./app";

describe("coach API", () => {
  let server: Server | undefined;
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
      server = undefined;
    }

    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  const apiUrl = () => {
    const address = server?.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  };

  const startServer = async () => {
    server = createApiApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server?.once("listening", resolve));
  };

  it("aborts model work when the browser disconnects", async () => {
    let resolveAborted!: () => void;
    const aborted = new Promise<void>((resolve) => {
      resolveAborted = resolve;
    });
    const generate = vi.fn(
      async (_payload: CoachApiPayload, options?: GenerateCoachOptions) =>
        new Promise<{ available: false }>((resolve) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              resolveAborted();
              resolve({ available: false });
            },
            { once: true },
          );
        }),
    );
    server = createApiApp(generate).listen(0, "127.0.0.1");
    await new Promise((resolve) => server?.once("listening", resolve));

    const controller = new AbortController();
    const pending = fetch(`${apiUrl()}/api/explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Solve x + 2 = 5.",
        choices: ["A: 1", "B: 3"],
        selectedAnswer: "A: 1",
        correctAnswers: ["B: 3"],
        topic: "Algebra — Linear equations",
        rationale: "Subtract 2 from both sides.",
      }),
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(aborted).resolves.toBeUndefined();
  });

  it("rejects malformed coach requests without calling the model", async () => {
    await startServer();

    const response = await fetch(`${apiUrl()}/api/explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "missing required fields" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid coach request." });
  });

  it.each([
    {
      label: "an SPR with no choices",
      payload: {
        question: "Enter one-half as a decimal or fraction.",
        choices: [],
        selectedAnswer: "0.4",
        correctAnswers: ["0.5", "1/2"],
        topic: "Advanced Math — Equivalent expressions",
        rationale: "One-half is equivalent to 0.5.",
      },
    },
    {
      label: "an MCQ with fewer than four choices",
      payload: {
        question: "Solve x + 2 = 5.",
        choices: ["A: 1", "B: 3"],
        selectedAnswer: "A: 1",
        correctAnswers: ["B: 3"],
        topic: "Algebra — Linear equations",
        rationale: "Subtract 2 from both sides.",
      },
    },
  ])("accepts $label", async ({ payload }) => {
    await startServer();

    const response = await fetch(`${apiUrl()}/api/explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ available: false });
  });
});

describe("progress API", () => {
  let server: Server | undefined;
  let directory: string | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  const startServer = async () => {
    directory = await mkdtemp(path.join(tmpdir(), "sat-progress-api-"));
    const progressFile = path.join(directory, "progress.json");
    server = createApiApp(undefined, progressFile).listen(0, "127.0.0.1");
    await new Promise((resolve) => server?.once("listening", resolve));
    const address = server.address() as AddressInfo;
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      progressFile,
    };
  };

  it("returns empty progress when no JSON file exists", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/api/progress`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 2, attempts: [] });
  });

  it("validates and persists progress through PUT", async () => {
    const { baseUrl, progressFile } = await startServer();
    const body = {
      version: 2,
      attempts: [
        {
          id: "attempt-1",
          questionId: "question-1",
          response: "B",
          correct: false,
          createdAt: "2026-08-03T12:00:00.000Z",
        },
      ],
    };

    const putResponse = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(putResponse.status).toBe(204);
    expect(await readFile(progressFile, "utf8")).toBe(JSON.stringify(body));
    const getResponse = await fetch(`${baseUrl}/api/progress`);
    expect(await getResponse.json()).toEqual(body);
  });

  it("loads the same progress document after the server restarts", async () => {
    const { baseUrl, progressFile } = await startServer();
    const body = {
      version: 2,
      attempts: [
        {
          id: "restart-attempt",
          questionId: "question-1",
          response: "A",
          correct: true,
          createdAt: "2026-08-03T12:00:00.000Z",
        },
      ],
    };
    const saved = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(saved.status).toBe(204);

    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = createApiApp(undefined, progressFile).listen(0, "127.0.0.1");
    await new Promise((resolve) => server?.once("listening", resolve));
    const restartedAddress = server.address() as AddressInfo;

    const restored = await fetch(
      `http://127.0.0.1:${restartedAddress.port}/api/progress`,
    );
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual(body);
  });

  it("accepts a full practice history larger than the coach request limit", async () => {
    const { baseUrl } = await startServer();
    const body = {
      version: 2,
      attempts: Array.from({ length: 400 }, (_, index) => ({
        id: `attempt-${index}`,
        questionId: `question-${index}`,
        response: "A response long enough to put the document above 32kb",
        correct: index % 2 === 0,
        createdAt: "2026-08-03T12:00:00.000Z",
      })),
    };
    expect(JSON.stringify(body).length).toBeGreaterThan(32 * 1024);

    const response = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(204);
    const stored = await fetch(`${baseUrl}/api/progress`);
    expect(await stored.json()).toEqual(body);
  });

  it("rejects malformed progress without changing the stored document", async () => {
    const { baseUrl, progressFile } = await startServer();
    const original = { version: 2, attempts: [] };
    await writeFile(progressFile, JSON.stringify(original), "utf8");

    const response = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 2, attempts: [{ id: "bad" }] }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid progress document." });
    expect(JSON.parse(await readFile(progressFile, "utf8"))).toEqual(original);
  });

  it("returns a controlled error for malformed progress on disk", async () => {
    const { baseUrl, progressFile } = await startServer();
    await writeFile(progressFile, "{broken", "utf8");

    const response = await fetch(`${baseUrl}/api/progress`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Stored progress is unreadable." });
    expect(await readFile(progressFile, "utf8")).toBe("{broken");
  });
});

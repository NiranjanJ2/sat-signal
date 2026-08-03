import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

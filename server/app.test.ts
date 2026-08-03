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

  it("rejects malformed coach requests without calling the model", async () => {
    server = createApiApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server?.once("listening", resolve));

    const response = await fetch(`${apiUrl()}/api/explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "missing required fields" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid coach request." });
  });

  it("reports AI as optional when no server key is configured", async () => {
    server = createApiApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server?.once("listening", resolve));

    const response = await fetch(`${apiUrl()}/api/explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Solve x + 2 = 5.",
        choices: ["1", "2", "3", "4"],
        selectedAnswer: "1",
        correctAnswer: "3",
        topic: "Algebra — Linear equations",
        rationale: "Subtract 2 from both sides.",
      }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ available: false });
  });
});

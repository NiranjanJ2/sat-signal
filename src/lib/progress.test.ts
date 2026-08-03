import { describe, expect, it, vi } from "vitest";
import type { Attempt } from "../types";
import { initialPracticeState } from "./practice";
import {
  appendProgressAttempt,
  importProgressDocument,
  loadProgressDocument,
  progressGeneration,
  resetProgressDocument,
} from "./progress";

const attempt: Attempt = {
  id: "attempt-1",
  questionId: "question-1",
  response: "B",
  correct: false,
  createdAt: "2026-08-03T12:00:00.000Z",
};

const document = { version: 2, generation: 3, attempts: [attempt] };

describe("progressGeneration", () => {
  it("accepts only a versioned generated document envelope", () => {
    expect(progressGeneration(document)).toBe(3);
    expect(progressGeneration({ version: 2, attempts: [] })).toBeNull();
    expect(progressGeneration({ ...document, generation: -1 })).toBeNull();
    expect(progressGeneration({ ...document, attempts: "invalid" })).toBeNull();
  });
});

describe("loadProgressDocument", () => {
  it("loads a validated document from the local progress API", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(document), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const controller = new AbortController();

    await expect(loadProgressDocument(controller.signal, fetchImpl)).resolves.toEqual({
      available: true,
      document,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/progress", {
      signal: controller.signal,
    });
  });

  it("falls back for invalid, failed, and unavailable responses", async () => {
    const signal = new AbortController().signal;
    const invalid = vi.fn(async () =>
      new Response(JSON.stringify({ version: 2, attempts: [] }), { status: 200 }),
    );

    await expect(loadProgressDocument(signal, invalid)).resolves.toEqual({ available: false });
    await expect(
      loadProgressDocument(signal, vi.fn(async () => new Response(null, { status: 500 }))),
    ).resolves.toEqual({ available: false });
    await expect(
      loadProgressDocument(signal, vi.fn(async () => Promise.reject(new Error("offline")))),
    ).resolves.toEqual({ available: false });
  });

  it("does not swallow cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const error = new DOMException("Aborted", "AbortError");

    await expect(
      loadProgressDocument(controller.signal, vi.fn(async () => Promise.reject(error))),
    ).rejects.toBe(error);
  });
});

describe("progress mutations", () => {
  it("imports a generation-scoped attempt union", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const state = { ...initialPracticeState(), attempts: [attempt] };

    await expect(importProgressDocument(state, 3, fetchImpl)).resolves.toEqual({
      status: "saved",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/progress/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 2, generation: 3, attempts: [attempt] }),
    });
  });

  it("distinguishes a stale import from an unavailable server", async () => {
    const state = initialPracticeState();
    const conflict = vi.fn(async () =>
      new Response(JSON.stringify({ current: document }), { status: 409 }),
    );
    await expect(
      importProgressDocument(state, 2, conflict),
    ).resolves.toEqual({ status: "stale", document });
    await expect(
      importProgressDocument(state, 2, vi.fn(async () => new Response(null, { status: 500 }))),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("appends only the newly created attempt in its current generation", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));

    await expect(appendProgressAttempt(attempt, 3, fetchImpl)).resolves.toEqual({
      status: "saved",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/progress/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation: 3, attempt }),
    });
  });

  it("returns the current document when an append crosses a reset", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ current: document }), { status: 409 }),
    );

    await expect(appendProgressAttempt(attempt, 2, fetchImpl)).resolves.toEqual({
      status: "stale",
      document,
    });
  });

  it("resets through an explicit mutation and returns the new generation", async () => {
    const resetDocument = { version: 2, generation: 4, attempts: [] };
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(resetDocument), { status: 200 }),
    );

    await expect(resetProgressDocument(fetchImpl)).resolves.toEqual({
      available: true,
      document: resetDocument,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/progress", { method: "DELETE" });
  });
});

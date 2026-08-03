import { describe, expect, it, vi } from "vitest";
import { initialPracticeState } from "./practice";
import { loadProgressDocument, saveProgressDocument } from "./progress";

describe("loadProgressDocument", () => {
  it("loads the raw document from the local progress API", async () => {
    const document = { version: 2, attempts: [] };
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(document), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const controller = new AbortController();

    await expect(
      loadProgressDocument(controller.signal, fetchImpl),
    ).resolves.toEqual({ available: true, document });
    expect(fetchImpl).toHaveBeenCalledWith("/api/progress", {
      signal: controller.signal,
    });
  });

  it("falls back when the server is unavailable", async () => {
    const signal = new AbortController().signal;

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
      loadProgressDocument(
        controller.signal,
        vi.fn(async () => Promise.reject(error)),
      ),
    ).rejects.toBe(error);
  });
});

describe("saveProgressDocument", () => {
  it("writes only the versioned attempt history", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const state = {
      ...initialPracticeState(),
      unresolvedIds: ["question-1"],
      missedHistoryIds: ["question-1"],
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

    await expect(saveProgressDocument(state, fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 2, attempts: state.attempts }),
    });
    const request = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[1].body).not.toContain("unresolvedIds");
  });

  it("reports server and network failures", async () => {
    const state = initialPracticeState();

    await expect(
      saveProgressDocument(
        state,
        vi.fn(async () => new Response(null, { status: 500 })),
      ),
    ).resolves.toBe(false);
    await expect(
      saveProgressDocument(
        state,
        vi.fn(async () => Promise.reject(new Error("offline"))),
      ),
    ).resolves.toBe(false);
  });
});

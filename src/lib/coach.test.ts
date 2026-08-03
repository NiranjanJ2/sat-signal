import { describe, expect, it, vi } from "vitest";
import type { Question } from "../types";
import { localCoachSummary, requestCoachSummary } from "./coach";

const question: Question = {
  id: "math-algebra-1",
  section: "math",
  domain: "Algebra",
  skill: "Linear equations",
  difficulty: "medium",
  prompt: "Solve x + 2 = 5.",
  choices: ["1", "2", "3", "4"],
  answerIndex: 2,
  explanation: "Subtract 2 from both sides to get x = 3.",
};

describe("localCoachSummary", () => {
  it("deterministically recaps the selected and correct answers", () => {
    const first = localCoachSummary(question, 0);
    const second = localCoachSummary(question, 0);

    expect(first).toBe(second);
    expect(first).toContain("Linear equations");
    expect(first).toContain("A: 1");
    expect(first).toContain("C: 3");
    expect(first).toContain(question.explanation);
  });
});

describe("requestCoachSummary", () => {
  it("posts only the allowed question context and forwards the abort signal", async () => {
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ available: true, summary: "Use inverse operations." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const summary = await requestCoachSummary(
      { question, selectedIndex: 0 },
      signal,
      fetchImpl,
    );

    expect(summary).toBe("Use inverse operations.");
    expect(fetchImpl).toHaveBeenCalledWith("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Solve x + 2 = 5.",
        choices: ["1", "2", "3", "4"],
        selectedAnswer: "1",
        correctAnswer: "3",
        topic: "Algebra — Linear equations",
        rationale: "Subtract 2 from both sides to get x = 3.",
      }),
      signal,
    });
  });

  it("returns the local recap when the request fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      requestCoachSummary(
        { question, selectedIndex: 0 },
        new AbortController().signal,
        fetchImpl,
      ),
    ).resolves.toBe(localCoachSummary(question, 0));
  });

  it("returns the local recap for unavailable or malformed endpoint output", async () => {
    const responses = [
      new Response(JSON.stringify({ available: false }), { status: 503 }),
      new Response("not json", { status: 200 }),
      new Response(JSON.stringify({ available: true, summary: "   " }), {
        status: 200,
      }),
    ];

    for (const response of responses) {
      const fetchImpl = vi.fn(async () => response);

      await expect(
        requestCoachSummary(
          { question, selectedIndex: 0 },
          new AbortController().signal,
          fetchImpl,
        ),
      ).resolves.toBe(localCoachSummary(question, 0));
    }
  });
});

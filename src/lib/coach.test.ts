import { describe, expect, it, vi } from "vitest";
import type { QuestionDetail } from "../types";
import { localCoachSummary, requestCoachSummary } from "./coach";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const multipleChoiceQuestion: QuestionDetail = {
  id: "math-algebra-1",
  externalId: "math-algebra-1",
  section: "math",
  domainCode: "H",
  domain: "Algebra",
  skillCode: "LE",
  skill: "Linear equations",
  difficulty: "medium",
  kind: "multiple-choice",
  stimulusHtml:
    '<p>Use the recorded <strong>equation</strong>.</p><img src="data:image/png;base64,PRIVATE_IMAGE">',
  promptHtml: "<p>Solve <em>x</em> + 2 = 5.</p><script>PRIVATE_SCRIPT</script>",
  choices: [
    { id: "option-a", label: "A", html: "<p>1</p>" },
    { id: "option-b", label: "B", html: "<p>3</p>" },
  ],
  correctAnswers: ["B"],
  rationaleHtml:
    '<p>Subtract 2 from both sides to get <strong>x = 3</strong>.</p><img src="data:image/png;base64,PRIVATE_RATIONALE">',
};

const sprQuestion: QuestionDetail = {
  ...multipleChoiceQuestion,
  id: "math-spr-1",
  externalId: "math-spr-1",
  kind: "student-produced-response",
  stimulusHtml: "",
  promptHtml: "<p>Enter one-half as a decimal or fraction.</p>",
  choices: [],
  correctAnswers: ["0.5", "1/2"],
  rationaleHtml: "<p>One-half is equivalent to 0.5.</p>",
};

describe("localCoachSummary", () => {
  it("recaps an MCQ response and accepted answer as sanitized plain text", () => {
    const summary = localCoachSummary(multipleChoiceQuestion, "option-a");

    expect(summary).toContain("Linear equations");
    expect(summary).toContain("A: 1");
    expect(summary).toContain("B: 3");
    expect(summary).toContain("Subtract 2 from both sides to get x = 3.");
    expect(summary).not.toMatch(/<[^>]+>|PRIVATE_/);
  });

  it("recaps a student-produced response and every accepted answer", () => {
    const summary = localCoachSummary(sprQuestion, "0.4");

    expect(summary).toContain("0.4");
    expect(summary).toContain("0.5");
    expect(summary).toContain("1/2");
  });
});

describe("requestCoachSummary", () => {
  it("posts sanitized College Board context and forwards the abort signal", async () => {
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(
        JSON.stringify({ available: true, summary: "Use inverse operations." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const summary = await requestCoachSummary(
      { question: multipleChoiceQuestion, response: "option-a" },
      signal,
      fetchImpl,
    );

    expect(summary).toBe("Use inverse operations.");
    expect(fetchImpl).toHaveBeenCalledWith("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Use the recorded equation.\n\nSolve x + 2 = 5.",
        choices: ["A: 1", "B: 3"],
        selectedAnswer: "A: 1",
        correctAnswers: ["B: 3"],
        topic: "Algebra — Linear equations",
        rationale: "Subtract 2 from both sides to get x = 3.",
      }),
      signal,
    });

    const body = String(fetchImpl.mock.calls[0]?.[1]?.body);
    expect(body).not.toMatch(/<[^>]+>|PRIVATE_|base64/i);
  });

  it("supports SPR payloads with no choices and multiple accepted answers", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      new Response(JSON.stringify({ available: false }), { status: 503 }),
    );

    await requestCoachSummary(
      { question: sprQuestion, response: "0.4" },
      new AbortController().signal,
      fetchImpl,
    );

    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      choices: [],
      selectedAnswer: "0.4",
      correctAnswers: ["0.5", "1/2"],
    });
  });

  it("returns the local recap when a non-abort request fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      requestCoachSummary(
        { question: multipleChoiceQuestion, response: "option-a" },
        new AbortController().signal,
        fetchImpl,
      ),
    ).resolves.toBe(localCoachSummary(multipleChoiceQuestion, "option-a"));
  });

  it("rethrows AbortError instead of replacing cancellation with a fallback", async () => {
    const abortError = new DOMException("cancelled", "AbortError");
    const fetchImpl = vi.fn(async () => {
      throw abortError;
    });

    await expect(
      requestCoachSummary(
        { question: multipleChoiceQuestion, response: "option-a" },
        new AbortController().signal,
        fetchImpl,
      ),
    ).rejects.toBe(abortError);
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
          { question: multipleChoiceQuestion, response: "option-a" },
          new AbortController().signal,
          fetchImpl,
        ),
      ).resolves.toBe(localCoachSummary(multipleChoiceQuestion, "option-a"));
    }
  });
});

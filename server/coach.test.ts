import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoachApiPayload } from "../src/lib/coach-contract";
import { generateCoachSummary } from "./coach";

const payload: CoachApiPayload = {
  question: "Solve x + 2 = 5.",
  choices: ["A: 1", "B: 3"],
  selectedAnswer: "A: 1",
  correctAnswers: ["B: 3"],
  topic: "Algebra — Linear equations",
  rationale: "Subtract 2 from both sides to get x = 3.",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

describe("generateCoachSummary", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unavailable without an API key and makes no request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(generateCoachSummary(payload, { fetchImpl })).resolves.toEqual({
      available: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts a non-stored plain-text recap request and extracts the first output_text", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({
        output: [
          { type: "reasoning", summary: [] },
          {
            type: "message",
            content: [
              { type: "refusal", refusal: "" },
              { type: "output_text", text: "  Use inverse operations.  ", annotations: [] },
              { type: "output_text", text: "This should not be selected.", annotations: [] },
            ],
          },
        ],
      }),
    );

    const result = await generateCoachSummary(payload, {
      apiKey: "server-secret",
      fetchImpl,
    });

    expect(result).toEqual({ available: true, summary: "Use inverse operations." });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toEqual({
      Authorization: "Bearer server-secret",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "gpt-5.6-luna",
      store: false,
      instructions: expect.stringMatching(/concise.*plain text/i),
      input: expect.stringContaining("Solve x + 2 = 5."),
    });
    expect(JSON.parse(String(init?.body)).input).toContain(
      "Accepted answers: B: 3",
    );
  });

  it("uses the configured model override", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-custom");
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Try isolating x." }],
          },
        ],
      }),
    );

    await generateCoachSummary(payload, {
      apiKey: "server-secret",
      fetchImpl,
    });

    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "gpt-custom" });
  });

  it.each([
    ["a non-2xx response", () => jsonResponse({ error: "rate limited" }, 429)],
    ["invalid JSON", () => new Response("not json", { status: 200 })],
    ["a malformed payload", () => jsonResponse({ output: [{ type: "message" }] })],
    [
      "empty output text",
      () =>
        jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "   " }],
            },
          ],
        }),
    ],
  ])("reports unavailable for %s", async (_label, response) => {
    const fetchImpl = vi.fn<FetchLike>(async () => response());

    await expect(
      generateCoachSummary(payload, { apiKey: "server-secret", fetchImpl }),
    ).resolves.toEqual({ available: false });
  });
});

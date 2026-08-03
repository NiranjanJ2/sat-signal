import type { CoachApiPayload } from "../src/lib/coach-contract";

export type CoachGenerationResult =
  | { available: false }
  | { available: true; summary: string };

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type GenerateCoachOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
const DEFAULT_TIMEOUT_MS = 15_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const firstOutputText = (value: unknown): string | undefined => {
  if (!isRecord(value) || !Array.isArray(value.output)) {
    return undefined;
  }

  for (const outputItem of value.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentPart of outputItem.content) {
      if (
        isRecord(contentPart) &&
        contentPart.type === "output_text" &&
        typeof contentPart.text === "string"
      ) {
        const summary = contentPart.text.trim();
        return summary.length > 0 ? summary : undefined;
      }
    }
  }

  return undefined;
};

const coachInput = (payload: CoachApiPayload): string =>
  [
    `Topic: ${payload.topic}`,
    `Question: ${payload.question}`,
    `Choices: ${
      payload.choices.length > 0
        ? payload.choices.join(" | ")
        : "(student-produced response)"
    }`,
    `Student selected: ${payload.selectedAnswer}`,
    `Accepted answers: ${payload.correctAnswers.join(" | ")}`,
    `Built-in rationale: ${payload.rationale}`,
  ].join("\n");

export const generateCoachSummary = async (
  payload: CoachApiPayload,
  options: GenerateCoachOptions = {},
): Promise<CoachGenerationResult> => {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return { available: false };
  }

  const model =
    (options.model ?? process.env.OPENAI_MODEL)?.trim() || DEFAULT_OPENAI_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutSignal = AbortSignal.timeout(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 250,
        instructions:
          "Give a concise SAT coaching recap in plain text. Explain the key idea and one useful next step without changing the recorded result.",
        input: coachInput(payload),
      }),
      signal,
    });

    if (!response.ok) {
      return { available: false };
    }

    const responseBody: unknown = await response.json();
    const summary = firstOutputText(responseBody);
    return summary === undefined
      ? { available: false }
      : { available: true, summary };
  } catch {
    return { available: false };
  }
};

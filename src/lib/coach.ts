import type { Question } from "../types";

export type CoachRequest = {
  question: Question;
  selectedIndex: number;
};

export type CoachApiPayload = {
  question: string;
  choices: readonly string[];
  selectedAnswer: string;
  correctAnswer: string;
  topic: string;
  rationale: string;
};

type CoachApiResult =
  | { available: false }
  | { available: true; summary: string };

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const answerLabels = ["A", "B", "C", "D"] as const;

const answerDescription = (question: Question, index: number): string => {
  const label = answerLabels[index];
  const choice = question.choices[index];

  return label !== undefined && choice !== undefined
    ? `${label}: ${choice}`
    : "an unavailable option";
};

export const localCoachSummary = (
  question: Question,
  selectedIndex: number,
): string =>
  `Focus on ${question.skill}. You chose ${answerDescription(question, selectedIndex)}; ` +
  `the correct answer is ${answerDescription(question, question.answerIndex)}. ` +
  question.explanation;

const toApiPayload = ({
  question,
  selectedIndex,
}: CoachRequest): CoachApiPayload => ({
  question: question.passage
    ? `${question.passage}\n\n${question.prompt}`
    : question.prompt,
  choices: question.choices,
  selectedAnswer: question.choices[selectedIndex] ?? "",
  correctAnswer: question.choices[question.answerIndex],
  topic: `${question.domain} — ${question.skill}`,
  rationale: question.explanation,
});

const isCoachApiResult = (value: unknown): value is CoachApiResult => {
  if (typeof value !== "object" || value === null || !("available" in value)) {
    return false;
  }

  if (value.available === false) {
    return true;
  }

  return (
    value.available === true &&
    "summary" in value &&
    typeof value.summary === "string" &&
    value.summary.trim().length > 0
  );
};

export const requestCoachSummary = async (
  request: CoachRequest,
  signal: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<string> => {
  const fallback = localCoachSummary(request.question, request.selectedIndex);

  try {
    const response = await fetchImpl("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiPayload(request)),
      signal,
    });

    if (!response.ok) {
      return fallback;
    }

    const result: unknown = await response.json();
    return isCoachApiResult(result) && result.available
      ? result.summary.trim()
      : fallback;
  } catch {
    return fallback;
  }
};

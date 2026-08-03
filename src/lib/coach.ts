import { htmlToPlainText } from "../components/RichHtml";
import type { QuestionChoice, QuestionDetail } from "../types";
import type { CoachApiPayload } from "./coach-contract";

export type { CoachApiPayload } from "./coach-contract";

export type CoachRequest = {
  question: QuestionDetail;
  response: string;
};

type CoachApiResult =
  | { available: false }
  | { available: true; summary: string };

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const describeChoice = (choice: QuestionChoice): string => {
  const content = htmlToPlainText(choice.html);
  return content ? `${choice.label}: ${content}` : choice.label;
};

const matchingChoice = (
  question: QuestionDetail,
  answer: string,
): QuestionChoice | undefined => {
  const normalized = answer.trim().toLowerCase();
  return question.choices.find(
    (choice) =>
      choice.id.trim().toLowerCase() === normalized ||
      choice.label.trim().toLowerCase() === normalized,
  );
};

const answerDescription = (
  question: QuestionDetail,
  answer: string,
): string => {
  const choice = matchingChoice(question, answer);
  if (choice) {
    return describeChoice(choice);
  }

  return answer.trim() || "No response submitted";
};

const acceptedAnswerDescriptions = (question: QuestionDetail): string[] =>
  question.correctAnswers.map((answer) => answerDescription(question, answer));

const plainRationale = (question: QuestionDetail): string =>
  htmlToPlainText(question.rationaleHtml) ||
  "No built-in rationale was supplied for this question.";

export const localCoachSummary = (
  question: QuestionDetail,
  response: string,
): string => {
  const accepted = acceptedAnswerDescriptions(question);
  const answerLabel = accepted.length === 1 ? "Accepted answer" : "Accepted answers";

  return (
    `Focus on ${question.skill}. You answered ${answerDescription(question, response)}. ` +
    `${answerLabel}: ${accepted.join(" or ")}. ${plainRationale(question)}`
  );
};

const toApiPayload = ({ question, response }: CoachRequest): CoachApiPayload => {
  const stimulus = htmlToPlainText(question.stimulusHtml);
  const prompt = htmlToPlainText(question.promptHtml);

  return {
    question: [stimulus, prompt].filter(Boolean).join("\n\n"),
    choices: question.choices.map(describeChoice),
    selectedAnswer: answerDescription(question, response),
    correctAnswers: acceptedAnswerDescriptions(question),
    topic: `${question.domain} — ${question.skill}`,
    rationale: plainRationale(question),
  };
};

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

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

export const requestCoachSummary = async (
  request: CoachRequest,
  signal: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<string> => {
  const fallback = localCoachSummary(request.question, request.response);

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
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      throw error;
    }
    return fallback;
  }
};

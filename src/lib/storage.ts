import type { Attempt, PracticeState, QuestionMeta } from "../types";
import { initialPracticeState, recordAttempt } from "./practice";

export const PRACTICE_STORAGE_KEY = "sat-practice-state";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function loadPracticeState(
  storage: StorageLike,
  questions: readonly QuestionMeta[],
): PracticeState {
  try {
    const stored = storage.getItem(PRACTICE_STORAGE_KEY);
    if (stored === null) {
      return initialPracticeState();
    }

    const parsed: unknown = JSON.parse(stored);
    if (!isPracticeStateDocument(parsed)) {
      return initialPracticeState();
    }

    const questionsById = new Map(
      questions.map((question) => [question.id, question]),
    );
    const attempts = normalizeAttempts(parsed.attempts, questionsById);

    return attempts.reduce(recordAttempt, initialPracticeState());
  } catch {
    return initialPracticeState();
  }
}

export function savePracticeState(
  storage: StorageLike,
  state: PracticeState,
): boolean {
  try {
    storage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({ version: 2, attempts: state.attempts }),
    );
    return true;
  } catch {
    return false;
  }
}

type StoredPracticeState = {
  version: 2;
  attempts: unknown[];
};

function isPracticeStateDocument(value: unknown): value is StoredPracticeState {
  return (
    isRecord(value) &&
    value.version === 2 &&
    Array.isArray(value.attempts)
  );
}

function normalizeAttempts(
  values: readonly unknown[],
  questionsById: ReadonlyMap<string, QuestionMeta>,
): Attempt[] {
  const attempts: Attempt[] = [];
  const seenIds = new Set<string>();

  for (const value of values) {
    if (!isAttempt(value) || seenIds.has(value.id)) {
      continue;
    }

    const question = questionsById.get(value.questionId);
    if (!question) {
      continue;
    }

    seenIds.add(value.id);
    attempts.push(value);
  }

  return attempts;
}

function isAttempt(value: unknown): value is Attempt {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.questionId === "string" &&
    value.questionId.trim().length > 0 &&
    typeof value.response === "string" &&
    value.response.trim().length > 0 &&
    typeof value.correct === "boolean" &&
    typeof value.createdAt === "string" &&
    value.createdAt.trim().length > 0 &&
    !Number.isNaN(Date.parse(value.createdAt))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

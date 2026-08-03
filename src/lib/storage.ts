import type { Attempt, PracticeState, Question } from "../types";
import { initialPracticeState, recordAttempt } from "./practice";

export const PRACTICE_STORAGE_KEY = "sat-practice-state";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function loadPracticeState(
  storage: StorageLike,
  questions: readonly Question[],
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
    storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

type StoredPracticeState = {
  version: 1;
  attempts: unknown[];
  unresolvedIds: unknown[];
  missedHistoryIds: unknown[];
};

function isPracticeStateDocument(value: unknown): value is StoredPracticeState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.attempts) &&
    Array.isArray(value.unresolvedIds) &&
    Array.isArray(value.missedHistoryIds)
  );
}

function normalizeAttempts(
  values: readonly unknown[],
  questionsById: ReadonlyMap<string, Question>,
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
    attempts.push({
      ...value,
      correct: value.selectedIndex === question.answerIndex,
    });
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
    typeof value.selectedIndex === "number" &&
    Number.isInteger(value.selectedIndex) &&
    value.selectedIndex >= 0 &&
    value.selectedIndex <= 3 &&
    typeof value.correct === "boolean" &&
    typeof value.createdAt === "string" &&
    value.createdAt.trim().length > 0 &&
    !Number.isNaN(Date.parse(value.createdAt))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { Attempt, PracticeState, QuestionMeta } from "../types";
import { initialPracticeState, recordAttempt } from "./practice";

export const PRACTICE_STORAGE_KEY = "sat-practice-state";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type PracticeSnapshot = {
  state: PracticeState;
  generation: number | null;
};

export function loadPracticeState(
  storage: StorageLike,
  questions: readonly QuestionMeta[],
): PracticeState {
  return loadPracticeSnapshot(storage, questions).state;
}

export function loadPracticeSnapshot(
  storage: StorageLike,
  questions: readonly QuestionMeta[],
): PracticeSnapshot {
  try {
    const stored = storage.getItem(PRACTICE_STORAGE_KEY);
    if (stored === null) {
      return emptySnapshot();
    }

    const document: unknown = JSON.parse(stored);
    if (!isPracticeStateDocument(document)) {
      return emptySnapshot();
    }

    return {
      state: hydratePracticeStateDocument(document, questions),
      generation: normalizeGeneration(document.generation),
    };
  } catch {
    return emptySnapshot();
  }
}

export function hydratePracticeStateDocument(
  value: unknown,
  _questions: readonly QuestionMeta[],
): PracticeState {
  if (!isPracticeStateDocument(value)) {
    return initialPracticeState();
  }

  const attempts = normalizeAttempts(value.attempts);

  return attempts.reduce(recordAttempt, initialPracticeState());
}

export function mergePracticeStates(
  ...states: readonly PracticeState[]
): PracticeState {
  const attempts: Attempt[] = [];
  const seenIds = new Set<string>();

  for (const state of states) {
    for (const attempt of state.attempts) {
      if (seenIds.has(attempt.id)) {
        continue;
      }

      seenIds.add(attempt.id);
      attempts.push(attempt);
    }
  }

  attempts.sort((left, right) => {
    const timeDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return timeDifference || left.id.localeCompare(right.id);
  });

  return attempts.reduce(recordAttempt, initialPracticeState());
}

export function savePracticeState(
  storage: StorageLike,
  state: PracticeState,
  generation?: number | null,
): boolean {
  try {
    const document: {
      version: 2;
      attempts: Attempt[];
      generation?: number;
    } = { version: 2, attempts: state.attempts };
    const validGeneration = normalizeGeneration(generation);
    if (validGeneration !== null) {
      document.generation = validGeneration;
    }

    storage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify(document),
    );
    return true;
  } catch {
    return false;
  }
}

type StoredPracticeState = {
  version: 2;
  attempts: unknown[];
  generation?: unknown;
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
): Attempt[] {
  const attempts: Attempt[] = [];
  const seenIds = new Set<string>();

  for (const value of values) {
    if (!isAttempt(value) || seenIds.has(value.id)) {
      continue;
    }

    seenIds.add(value.id);
    attempts.push(value);
  }

  return attempts;
}

function emptySnapshot(): PracticeSnapshot {
  return { state: initialPracticeState(), generation: null };
}

function normalizeGeneration(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
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

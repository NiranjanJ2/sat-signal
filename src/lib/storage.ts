import type { Attempt, PracticeState } from "../types";
import { initialPracticeState } from "./practice";

export const PRACTICE_STORAGE_KEY = "sat-practice-state";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function loadPracticeState(
  storage: StorageLike,
  validQuestionIds: ReadonlySet<string>,
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

    return {
      version: 1,
      attempts: normalizeAttempts(parsed.attempts, validQuestionIds),
      unresolvedIds: normalizeQuestionIds(
        parsed.unresolvedIds,
        validQuestionIds,
      ),
      missedHistoryIds: normalizeQuestionIds(
        parsed.missedHistoryIds,
        validQuestionIds,
      ),
    };
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
  validQuestionIds: ReadonlySet<string>,
): Attempt[] {
  const attempts: Attempt[] = [];
  const seenIds = new Set<string>();

  for (const value of values) {
    if (
      !isAttempt(value) ||
      !validQuestionIds.has(value.questionId) ||
      seenIds.has(value.id)
    ) {
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

function normalizeQuestionIds(
  values: readonly unknown[],
  validQuestionIds: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  const seenIds = new Set<string>();

  for (const value of values) {
    if (
      typeof value !== "string" ||
      !validQuestionIds.has(value) ||
      seenIds.has(value)
    ) {
      continue;
    }

    seenIds.add(value);
    ids.push(value);
  }

  return ids;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

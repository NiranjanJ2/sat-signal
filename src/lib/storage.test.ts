import { describe, expect, it } from "vitest";
import type { Question } from "../types";
import { initialPracticeState } from "./practice";
import {
  PRACTICE_STORAGE_KEY,
  loadPracticeState,
  savePracticeState,
  type StorageLike,
} from "./storage";

const memoryStorage = (value: string | null = null): StorageLike & {
  current: string | null;
} => ({
  current: value,
  getItem() {
    return this.current;
  },
  setItem(_key, next) {
    this.current = next;
  },
});

const questions: Question[] = [
  {
    id: "q-1",
    section: "math",
    domain: "Algebra",
    skill: "Linear equations",
    difficulty: "medium",
    prompt: "Solve x + 2 = 5.",
    choices: ["1", "2", "3", "4"],
    answerIndex: 2,
    explanation: "Subtract 2 from both sides.",
  },
];

describe("loadPracticeState", () => {
  it("falls back safely for invalid JSON", () => {
    expect(loadPracticeState(memoryStorage("{"), questions)).toEqual(
      initialPracticeState(),
    );
  });

  it("recomputes correctness and rebuilds mistake memory from attempts", () => {
    const storage = memoryStorage(
      JSON.stringify({
        version: 1,
        attempts: [
          {
            id: "a-1",
            questionId: "q-1",
            selectedIndex: 0,
            correct: true,
            createdAt: "2026-08-03T00:00:00.000Z",
          },
          {
            id: "a-2",
            questionId: "q-1",
            selectedIndex: 2,
            correct: false,
            createdAt: "2026-08-03T00:01:00.000Z",
          },
        ],
        unresolvedIds: ["q-1"],
        missedHistoryIds: [],
      }),
    );

    expect(loadPracticeState(storage, questions)).toEqual({
      version: 1,
      attempts: [
        {
          id: "a-1",
          questionId: "q-1",
          selectedIndex: 0,
          correct: false,
          createdAt: "2026-08-03T00:00:00.000Z",
        },
        {
          id: "a-2",
          questionId: "q-1",
          selectedIndex: 2,
          correct: true,
          createdAt: "2026-08-03T00:01:00.000Z",
        },
      ],
      unresolvedIds: [],
      missedHistoryIds: ["q-1"],
    });
  });

  it("drops duplicate, malformed, and orphaned attempts before replay", () => {
    const storage = memoryStorage(
      JSON.stringify({
        version: 1,
        attempts: [
          {
            id: "a-1",
            questionId: "q-1",
            selectedIndex: 0,
            correct: true,
            createdAt: "2026-08-03T00:00:00.000Z",
          },
          {
            id: "a-1",
            questionId: "q-1",
            selectedIndex: 2,
            correct: true,
            createdAt: "2026-08-03T00:01:00.000Z",
          },
          { id: "bad", questionId: "q-1", selectedIndex: -1 },
          {
            id: "orphan",
            questionId: "old-question",
            selectedIndex: 0,
            correct: false,
            createdAt: "2026-08-03T00:02:00.000Z",
          },
        ],
        unresolvedIds: [],
        missedHistoryIds: [],
      }),
    );

    expect(loadPracticeState(storage, questions)).toEqual({
      version: 1,
      attempts: [
        {
          id: "a-1",
          questionId: "q-1",
          selectedIndex: 0,
          correct: false,
          createdAt: "2026-08-03T00:00:00.000Z",
        },
      ],
      unresolvedIds: ["q-1"],
      missedHistoryIds: ["q-1"],
    });
  });

  it("survives storage access errors", () => {
    const throwing: StorageLike = {
      getItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
    };

    expect(loadPracticeState(throwing, questions)).toEqual(
      initialPracticeState(),
    );
    expect(savePracticeState(throwing, initialPracticeState())).toBe(false);
  });
});

describe("savePracticeState", () => {
  it("writes one atomic versioned document", () => {
    const storage = memoryStorage();

    expect(savePracticeState(storage, initialPracticeState())).toBe(true);
    expect(storage.current).toBe(JSON.stringify(initialPracticeState()));
    expect(storage.getItem(PRACTICE_STORAGE_KEY)).toBe(storage.current);
  });
});

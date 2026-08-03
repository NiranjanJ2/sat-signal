import { describe, expect, it } from "vitest";
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

describe("loadPracticeState", () => {
  it("falls back safely for invalid JSON", () => {
    expect(loadPracticeState(memoryStorage("{"), new Set(["q-1"]))).toEqual(
      initialPracticeState(),
    );
  });

  it("normalizes duplicates, malformed attempts, and orphaned question ids", () => {
    const storage = memoryStorage(
      JSON.stringify({
        version: 1,
        attempts: [
          {
            id: "a-1",
            questionId: "q-1",
            selectedIndex: 2,
            correct: true,
            createdAt: "2026-08-03T00:00:00.000Z",
          },
          {
            id: "a-1",
            questionId: "q-1",
            selectedIndex: 2,
            correct: true,
            createdAt: "2026-08-03T00:00:00.000Z",
          },
          { id: "bad", questionId: "q-1", selectedIndex: -1 },
          {
            id: "orphan",
            questionId: "old-question",
            selectedIndex: 0,
            correct: false,
            createdAt: "2026-08-03T00:00:00.000Z",
          },
        ],
        unresolvedIds: ["q-1", "q-1", "old-question"],
        missedHistoryIds: ["q-1", "q-1", "old-question"],
      }),
    );

    expect(loadPracticeState(storage, new Set(["q-1"]))).toEqual({
      version: 1,
      attempts: [
        {
          id: "a-1",
          questionId: "q-1",
          selectedIndex: 2,
          correct: true,
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

    expect(loadPracticeState(throwing, new Set(["q-1"]))).toEqual(
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


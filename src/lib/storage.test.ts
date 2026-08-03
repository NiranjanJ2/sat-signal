import { describe, expect, it } from "vitest";
import type { QuestionMeta } from "../types";
import { initialPracticeState } from "./practice";
import {
  PRACTICE_STORAGE_KEY,
  hydratePracticeStateDocument,
  loadPracticeState,
  mergePracticeStates,
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

const catalog: QuestionMeta[] = [
  {
    id: "external-q-1",
    externalId: "external-q-1",
    section: "math",
    domainCode: "H",
    domain: "Algebra",
    skillCode: "H.A.",
    skill: "Linear equations in one variable",
    difficulty: "medium",
  },
];

describe("loadPracticeState", () => {
  it("resets the bundled-bank version 1 schema", () => {
    const old = memoryStorage(
      JSON.stringify({
        version: 1,
        attempts: [],
        unresolvedIds: [],
        missedHistoryIds: [],
      }),
    );

    expect(loadPracticeState(old, catalog)).toEqual(initialPracticeState());
  });

  it("falls back safely for invalid JSON", () => {
    expect(loadPracticeState(memoryStorage("{"), catalog)).toEqual(
      initialPracticeState(),
    );
  });

  it("drops malformed, duplicate, and orphaned attempts then rebuilds queues", () => {
    const storage = memoryStorage(
      JSON.stringify({
        version: 2,
        attempts: [
          {
            id: "a-1",
            questionId: "external-q-1",
            response: "B",
            correct: false,
            createdAt: "2026-08-03T00:00:00.000Z",
          },
          {
            id: "a-1",
            questionId: "external-q-1",
            response: "B",
            correct: false,
            createdAt: "2026-08-03T00:01:00.000Z",
          },
          { id: "bad", questionId: "external-q-1", response: "", correct: false },
          {
            id: "orphan",
            questionId: "removed-id",
            response: "A",
            correct: false,
            createdAt: "2026-08-03T00:02:00.000Z",
          },
          {
            id: "a-2",
            questionId: "external-q-1",
            response: "C",
            correct: true,
            createdAt: "2026-08-03T00:03:00.000Z",
          },
        ],
        unresolvedIds: ["forged-id"],
        missedHistoryIds: [],
      }),
    );

    expect(loadPracticeState(storage, catalog)).toEqual({
      version: 2,
      attempts: [
        {
          id: "a-1",
          questionId: "external-q-1",
          response: "B",
          correct: false,
          createdAt: "2026-08-03T00:00:00.000Z",
        },
        {
          id: "a-2",
          questionId: "external-q-1",
          response: "C",
          correct: true,
          createdAt: "2026-08-03T00:03:00.000Z",
        },
      ],
      unresolvedIds: [],
      missedHistoryIds: ["external-q-1"],
    });
  });

  it("survives storage access and quota errors", () => {
    const throwing: StorageLike = {
      getItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem() {
        throw new DOMException("Full", "QuotaExceededError");
      },
    };

    expect(loadPracticeState(throwing, catalog)).toEqual(initialPracticeState());
    expect(savePracticeState(throwing, initialPracticeState())).toBe(false);
  });
});

describe("hydratePracticeStateDocument", () => {
  it("validates a raw server document against the live catalog", () => {
    expect(
      hydratePracticeStateDocument(
        {
          version: 2,
          attempts: [
            {
              id: "server-attempt",
              questionId: "external-q-1",
              response: "12",
              correct: false,
              createdAt: "2026-08-03T00:00:00.000Z",
            },
            {
              id: "orphan",
              questionId: "removed-question",
              response: "A",
              correct: true,
              createdAt: "2026-08-03T00:01:00.000Z",
            },
          ],
        },
        catalog,
      ),
    ).toMatchObject({
      attempts: [{ id: "server-attempt" }],
      unresolvedIds: ["external-q-1"],
    });
  });
});

describe("mergePracticeStates", () => {
  it("unions browser and JSON attempts chronologically then rebuilds miss memory", () => {
    const remote = hydratePracticeStateDocument(
      {
        version: 2,
        attempts: [
          {
            id: "remote-miss",
            questionId: "external-q-1",
            response: "B",
            correct: false,
            createdAt: "2026-08-03T00:00:00.000Z",
          },
        ],
      },
      catalog,
    );
    const browser = hydratePracticeStateDocument(
      {
        version: 2,
        attempts: [
          {
            id: "browser-resolution",
            questionId: "external-q-1",
            response: "C",
            correct: true,
            createdAt: "2026-08-03T00:02:00.000Z",
          },
          {
            id: "remote-miss",
            questionId: "external-q-1",
            response: "forged duplicate",
            correct: true,
            createdAt: "2026-08-03T00:03:00.000Z",
          },
        ],
      },
      catalog,
    );

    expect(mergePracticeStates(remote, browser)).toMatchObject({
      attempts: [
        { id: "remote-miss", correct: false },
        { id: "browser-resolution", correct: true },
      ],
      unresolvedIds: [],
      missedHistoryIds: ["external-q-1"],
    });
  });
});

describe("savePracticeState", () => {
  it("writes one atomic document containing ids and attempts but no question content", () => {
    const storage = memoryStorage();
    const state = initialPracticeState();

    expect(savePracticeState(storage, state)).toBe(true);
    expect(storage.current).toBe(JSON.stringify({ version: 2, attempts: [] }));
    expect(storage.getItem(PRACTICE_STORAGE_KEY)).toBe(storage.current);
    expect(storage.current).not.toContain("rationale");
    expect(storage.current).not.toContain("answerOptions");
  });
});

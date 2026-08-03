import { describe, expect, it } from "vitest";
import type { Attempt, Filters, PracticeState, Question } from "../types";
import {
  deriveTopicStats,
  filterQuestions,
  recordAttempt,
} from "./practice";

const question = (overrides: Partial<Question> = {}): Question => ({
  id: "q-1",
  section: "math",
  domain: "Algebra",
  skill: "Linear equations",
  difficulty: "medium",
  prompt: "Solve x + 2 = 5.",
  choices: ["1", "2", "3", "4"],
  answerIndex: 2,
  explanation: "Subtract 2 from both sides.",
  ...overrides,
});

const filters: Filters = {
  subject: "All",
  domain: "All",
  difficulty: "All",
  mode: "all",
};

const emptyState: PracticeState = {
  version: 1,
  attempts: [],
  unresolvedIds: [],
  missedHistoryIds: [],
};

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: "attempt-1",
  questionId: "q-1",
  selectedIndex: 0,
  correct: false,
  createdAt: "2026-08-03T00:00:00.000Z",
  ...overrides,
});

describe("filterQuestions", () => {
  const bank = [
    question(),
    question({ id: "q-2", difficulty: "hard" }),
    question({
      id: "q-3",
      section: "reading-writing",
      domain: "Craft and Structure",
      difficulty: "hard",
    }),
  ];

  it("applies every active filter with intersection semantics", () => {
    expect(
      filterQuestions(
        bank,
        {
          subject: "math",
          domain: "Algebra",
          difficulty: "hard",
          mode: "all",
        },
        emptyState,
      ).map(({ id }) => id),
    ).toEqual(["q-2"]);
  });

  it("shows only unresolved questions in missed mode", () => {
    expect(
      filterQuestions(bank, { ...filters, mode: "missed" }, {
        ...emptyState,
        unresolvedIds: ["q-3", "missing-id"],
      }).map(({ id }) => id),
    ).toEqual(["q-3"]);
  });
});

describe("recordAttempt", () => {
  it("adds a wrong answer to both retry and missed history once", () => {
    const once = recordAttempt(emptyState, attempt());
    const twice = recordAttempt(once, attempt());

    expect(twice.attempts).toHaveLength(1);
    expect(twice.unresolvedIds).toEqual(["q-1"]);
    expect(twice.missedHistoryIds).toEqual(["q-1"]);
  });

  it("removes a corrected question from retry without erasing history", () => {
    const missed = recordAttempt(emptyState, attempt());
    const corrected = recordAttempt(
      missed,
      attempt({ id: "attempt-2", selectedIndex: 2, correct: true }),
    );

    expect(corrected.unresolvedIds).toEqual([]);
    expect(corrected.missedHistoryIds).toEqual(["q-1"]);
    expect(corrected.attempts).toHaveLength(2);
  });
});

describe("deriveTopicStats", () => {
  it("returns a defined not-started stat and derives attempted accuracy", () => {
    const bank = [question(), question({ id: "q-2", domain: "Geometry" })];
    const stats = deriveTopicStats(bank, [
      attempt(),
      attempt({ id: "attempt-2", questionId: "q-1", correct: true }),
    ]);

    expect(stats).toEqual([
      {
        domain: "Algebra",
        subject: "math",
        attempted: 2,
        correct: 1,
        accuracy: 50,
      },
      {
        domain: "Geometry",
        subject: "math",
        attempted: 0,
        correct: 0,
        accuracy: null,
      },
    ]);
  });
});


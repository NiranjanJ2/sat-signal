import { describe, expect, it } from "vitest";
import type { Attempt, Filters, PracticeState, QuestionMeta } from "../types";
import {
  deriveTopicStats,
  filterQuestions,
  recordAttempt,
} from "./practice";

const meta = (overrides: Partial<QuestionMeta> = {}): QuestionMeta => ({
  id: "external-q-1",
  externalId: "external-q-1",
  section: "math",
  domainCode: "H",
  domain: "Algebra",
  skillCode: "H.A.",
  skill: "Linear equations in one variable",
  difficulty: "medium",
  ...overrides,
});

const filters: Filters = {
  subject: "All",
  domain: "All",
  skill: "All",
  difficulty: "All",
  mode: "all",
};

const emptyState: PracticeState = {
  version: 2,
  attempts: [],
  unresolvedIds: [],
  missedHistoryIds: [],
};

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: "attempt-1",
  questionId: "external-q-1",
  response: "A",
  correct: false,
  createdAt: "2026-08-03T00:00:00.000Z",
  ...overrides,
});

describe("filterQuestions", () => {
  const catalog = [
    meta(),
    meta({ id: "external-q-2", externalId: "external-q-2", difficulty: "hard" }),
    meta({
      id: "external-q-3",
      externalId: "external-q-3",
      section: "reading-writing",
      domainCode: "CAS",
      domain: "Craft and Structure",
      skillCode: "WIC",
      skill: "Words in Context",
      difficulty: "hard",
    }),
  ];

  it("applies subject, domain, skill, and difficulty with intersection semantics", () => {
    expect(
      filterQuestions(
        catalog,
        {
          subject: "math",
          domain: "Algebra",
          skill: "Linear equations in one variable",
          difficulty: "hard",
          mode: "all",
        },
        emptyState,
      ).map(({ id }) => id),
    ).toEqual(["external-q-2"]);
  });

  it("shows only never-attempted questions in the default queue", () => {
    expect(
      filterQuestions(catalog, filters, {
        ...emptyState,
        attempts: [
          attempt(),
          attempt({
            id: "attempt-2",
            questionId: "external-q-2",
            response: "B",
            correct: true,
          }),
        ],
        unresolvedIds: ["external-q-1"],
        missedHistoryIds: ["external-q-1"],
      }).map(({ id }) => id),
    ).toEqual(["external-q-3"]);
  });

  it("shows only unresolved catalog ids in missed mode", () => {
    expect(
      filterQuestions(catalog, { ...filters, mode: "missed" }, {
        ...emptyState,
        unresolvedIds: ["external-q-3", "removed-id"],
      }).map(({ id }) => id),
    ).toEqual(["external-q-3"]);
  });
});

describe("recordAttempt", () => {
  it("adds a wrong response to retry and missed history exactly once", () => {
    const once = recordAttempt(emptyState, attempt());
    const twice = recordAttempt(once, attempt());

    expect(twice.attempts).toHaveLength(1);
    expect(twice.unresolvedIds).toEqual(["external-q-1"]);
    expect(twice.missedHistoryIds).toEqual(["external-q-1"]);
  });

  it("removes a corrected response from retry without erasing history", () => {
    const missed = recordAttempt(emptyState, attempt());
    const corrected = recordAttempt(
      missed,
      attempt({ id: "attempt-2", response: "C", correct: true }),
    );

    expect(corrected.unresolvedIds).toEqual([]);
    expect(corrected.missedHistoryIds).toEqual(["external-q-1"]);
    expect(corrected.attempts).toHaveLength(2);
  });
});

describe("deriveTopicStats", () => {
  it("derives catalog-domain stats without loading question details", () => {
    const catalog = [meta(), meta({ id: "external-q-2", domainCode: "S", domain: "Geometry and Trigonometry" })];
    const stats = deriveTopicStats(catalog, [
      attempt(),
      attempt({ id: "attempt-2", correct: true, response: "C" }),
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
        domain: "Geometry and Trigonometry",
        subject: "math",
        attempted: 0,
        correct: 0,
        accuracy: null,
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { initialPracticeState } from "./practice";

describe("initialPracticeState", () => {
  it("starts with a versioned, empty id-only practice memory", () => {
    expect(initialPracticeState()).toEqual({
      version: 2,
      attempts: [],
      unresolvedIds: [],
      missedHistoryIds: [],
    });
  });
});


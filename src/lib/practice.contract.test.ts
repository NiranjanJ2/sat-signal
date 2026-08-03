import { describe, expect, it } from "vitest";
import { initialPracticeState } from "./practice";

describe("initialPracticeState", () => {
  it("starts with a versioned, empty practice memory", () => {
    expect(initialPracticeState()).toEqual({
      version: 1,
      attempts: [],
      unresolvedIds: [],
      missedHistoryIds: [],
    });
  });
});


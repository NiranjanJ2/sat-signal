import type { PracticeState } from "../types";

export function initialPracticeState(): PracticeState {
  return {
    version: 1,
    attempts: [],
    unresolvedIds: [],
    missedHistoryIds: [],
  };
}


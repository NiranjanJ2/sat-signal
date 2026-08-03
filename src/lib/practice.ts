import type {
  Attempt,
  Filters,
  PracticeState,
  Question,
  TopicStat,
} from "../types";

export function initialPracticeState(): PracticeState {
  return {
    version: 1,
    attempts: [],
    unresolvedIds: [],
    missedHistoryIds: [],
  };
}

export function filterQuestions(
  questions: readonly Question[],
  filters: Filters,
  state: PracticeState,
): Question[] {
  const unresolvedIds = new Set(state.unresolvedIds);

  return questions.filter((question) => {
    return (
      (filters.subject === "All" || question.section === filters.subject) &&
      (filters.domain === "All" || question.domain === filters.domain) &&
      (filters.difficulty === "All" ||
        question.difficulty === filters.difficulty) &&
      (filters.mode === "all" || unresolvedIds.has(question.id))
    );
  });
}

export function recordAttempt(
  state: PracticeState,
  attempt: Attempt,
): PracticeState {
  if (state.attempts.some(({ id }) => id === attempt.id)) {
    return state;
  }

  const unresolvedIds = attempt.correct
    ? state.unresolvedIds.filter((id) => id !== attempt.questionId)
    : addUnique(state.unresolvedIds, attempt.questionId);
  const missedHistoryIds = attempt.correct
    ? state.missedHistoryIds
    : addUnique(state.missedHistoryIds, attempt.questionId);

  return {
    ...state,
    attempts: [...state.attempts, attempt],
    unresolvedIds,
    missedHistoryIds,
  };
}

export function deriveTopicStats(
  questions: readonly Question[],
  attempts: readonly Attempt[],
): TopicStat[] {
  const stats: TopicStat[] = [];
  const statsByTopic = new Map<string, TopicStat>();
  const topicByQuestionId = new Map<string, TopicStat>();

  for (const question of questions) {
    const topicKey = `${question.section}\0${question.domain}`;
    let topic = statsByTopic.get(topicKey);

    if (!topic) {
      topic = {
        domain: question.domain,
        subject: question.section,
        attempted: 0,
        correct: 0,
        accuracy: null,
      };
      statsByTopic.set(topicKey, topic);
      stats.push(topic);
    }

    topicByQuestionId.set(question.id, topic);
  }

  for (const attempt of attempts) {
    const topic = topicByQuestionId.get(attempt.questionId);
    if (!topic) {
      continue;
    }

    topic.attempted += 1;
    if (attempt.correct) {
      topic.correct += 1;
    }
  }

  return stats.map((topic) => ({
    ...topic,
    accuracy:
      topic.attempted === 0
        ? null
        : Math.round((topic.correct / topic.attempted) * 100),
  }));
}

function addUnique(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

import { useEffect, useMemo, useRef, useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { MemoryTrace } from "./components/MemoryTrace";
import { PracticeView } from "./components/PracticeView";
import { ReviewView } from "./components/ReviewView";
import { questions } from "./data/questions";
import {
  deriveTopicStats,
  filterQuestions,
  initialPracticeState,
  recordAttempt,
} from "./lib/practice";
import {
  loadPracticeState,
  savePracticeState,
  type StorageLike,
} from "./lib/storage";
import type {
  Attempt,
  Filters,
  PracticeState,
  Question,
  ViewMode,
} from "./types";

const DEFAULT_FILTERS: Filters = {
  subject: "All",
  domain: "All",
  difficulty: "All",
  mode: "all",
};

const questionById = new Map(questions.map((question) => [question.id, question]));
const memoryFallback = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (key) => memoryFallback.get(key) ?? null,
  setItem: (key, value) => {
    memoryFallback.set(key, value);
  },
};

let attemptSequence = 0;

const resolveStorage = (): StorageLike => {
  try {
    return window.localStorage;
  } catch {
    return memoryStorage;
  }
};

const nextAttemptId = (questionId: string): string => {
  attemptSequence += 1;
  return `${questionId}-${Date.now()}-${attemptSequence}`;
};

const countStreak = (attempts: readonly Attempt[]): number => {
  const days = new Set(
    attempts.map((attempt) => {
      const date = new Date(attempt.createdAt);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }),
  );
  if (days.size === 0) {
    return 0;
  }

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export default function App() {
  const storageRef = useRef<StorageLike | null>(null);
  if (storageRef.current === null) {
    storageRef.current = resolveStorage();
  }

  const [practiceState, setPracticeState] = useState<PracticeState>(() =>
    loadPracticeState(storageRef.current ?? memoryStorage, questions),
  );
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("practice");
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
    questions[0]?.id ?? null,
  );
  const [questionEpoch, setQuestionEpoch] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const resetCancelRef = useRef<HTMLButtonElement>(null);

  const pool = useMemo(
    () => filterQuestions(questions, filters, practiceState),
    [filters, practiceState],
  );
  const stats = useMemo(
    () => deriveTopicStats(questions, practiceState.attempts),
    [practiceState.attempts],
  );
  const currentQuestion = currentQuestionId
    ? (questionById.get(currentQuestionId) ?? null)
    : null;
  const streak = countStreak(practiceState.attempts);

  useEffect(() => {
    if (!resetOpen) {
      return;
    }

    resetCancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setResetOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [resetOpen]);

  const choosePoolStart = (nextFilters: Filters, state = practiceState) => {
    const nextPool = filterQuestions(questions, nextFilters, state);
    setCurrentQuestionId(nextPool[0]?.id ?? null);
    setQuestionEpoch((epoch) => epoch + 1);
  };

  const changeFilters = (nextFilters: Filters) => {
    setFilters(nextFilters);
    choosePoolStart(nextFilters);
  };

  const practiceAll = () => {
    setView("practice");
    setFilters(DEFAULT_FILTERS);
    choosePoolStart(DEFAULT_FILTERS);
  };

  const practiceMisses = () => {
    const nextFilters: Filters = { ...DEFAULT_FILTERS, mode: "missed" };
    setView("practice");
    setFilters(nextFilters);
    choosePoolStart(nextFilters);
  };

  const submitAnswer = (selectedIndex: number): boolean => {
    if (!currentQuestion) {
      return false;
    }

    const correct = selectedIndex === currentQuestion.answerIndex;
    const attempt: Attempt = {
      id: nextAttemptId(currentQuestion.id),
      questionId: currentQuestion.id,
      selectedIndex,
      correct,
      createdAt: new Date().toISOString(),
    };
    const nextState = recordAttempt(practiceState, attempt);
    setPracticeState(nextState);
    savePracticeState(storageRef.current ?? memoryStorage, nextState);
    return correct;
  };

  const nextQuestion = () => {
    if (pool.length === 0) {
      setCurrentQuestionId(null);
      setQuestionEpoch((epoch) => epoch + 1);
      return;
    }

    const currentIndex = pool.findIndex(
      (question) => question.id === currentQuestionId,
    );
    const nextIndex =
      pool.length === 1 || currentIndex < 0 ? 0 : (currentIndex + 1) % pool.length;
    setCurrentQuestionId(pool[nextIndex]?.id ?? null);
    setQuestionEpoch((epoch) => epoch + 1);
  };

  const confirmReset = () => {
    const nextState = initialPracticeState();
    setPracticeState(nextState);
    savePracticeState(storageRef.current ?? memoryStorage, nextState);
    setResetOpen(false);
    setView("practice");
    setFilters(DEFAULT_FILTERS);
    choosePoolStart(DEFAULT_FILTERS, nextState);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="wordmark" type="button" onClick={practiceAll}>
          <span className="wordmark-mark" aria-hidden="true">
            S
          </span>
          <span>
            SAT <strong>Signal</strong>
          </span>
        </button>

        <nav className="primary-nav" aria-label="Primary navigation">
          {(["practice", "review", "memory"] as const).map((item) => (
            <button
              type="button"
              className={view === item ? "is-active" : ""}
              aria-current={view === item ? "page" : undefined}
              key={item}
              onClick={() => setView(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="header-progress">
          <span className="streak">
            <i aria-hidden="true" />
            {streak} day streak
          </span>
          <button className="reset-trigger" type="button" onClick={() => setResetOpen(true)}>
            Reset
          </button>
        </div>
      </header>

      <main>
        {view === "practice" ? (
          <>
            <FilterBar
              filters={filters}
              questions={questions}
              unresolvedCount={practiceState.unresolvedIds.length}
              onChange={changeFilters}
            />
            <PracticeView
              key={`${currentQuestionId ?? "empty"}-${questionEpoch}`}
              currentQuestion={currentQuestion}
              pool={pool}
              stats={stats}
              unresolvedCount={practiceState.unresolvedIds.length}
              attemptedCount={practiceState.attempts.length}
              focusQuestion={questionEpoch > 0}
              onSubmit={submitAnswer}
              onNext={nextQuestion}
              onPracticeAll={practiceAll}
            />
          </>
        ) : null}

        {view === "review" ? (
          <ReviewView
            questions={questions}
            state={practiceState}
            onPracticeMisses={practiceMisses}
            onPracticeAll={practiceAll}
          />
        ) : null}

        {view === "memory" ? (
          <section className="view-page memory-page" aria-labelledby="memory-title">
            <header className="view-intro memory-intro">
              <div>
                <p className="section-index">Memory</p>
                <h1 id="memory-title">See the work become a pattern.</h1>
                <p>
                  Length shows accuracy. The dot rhythm tightens as attempts
                  accumulate, so one lucky answer never looks like mastery.
                </p>
              </div>
              <span className="memory-total">
                {practiceState.attempts.length.toString().padStart(2, "0")}
                <small>total attempts</small>
              </span>
            </header>
            <MemoryTrace stats={stats} />

            <section className="recent-activity" aria-labelledby="recent-title">
              <div className="review-section-heading">
                <h2 id="recent-title">Recent activity</h2>
                <span>Latest 06</span>
              </div>
              {practiceState.attempts.length === 0 ? (
                <p className="review-empty">
                  Your most recent answers will appear here after the first check.
                </p>
              ) : (
                <ol>
                  {practiceState.attempts
                    .slice(-6)
                    .reverse()
                    .map((attempt) => {
                      const question = questionById.get(attempt.questionId) as
                        | Question
                        | undefined;
                      return (
                        <li key={attempt.id}>
                          <span className={attempt.correct ? "activity-correct" : "activity-missed"}>
                            {attempt.correct ? "Correct" : "Missed"}
                          </span>
                          <strong>{question?.domain ?? "Unknown topic"}</strong>
                          <span>{question?.skill ?? "Question removed"}</span>
                          <time dateTime={attempt.createdAt}>
                            {new Intl.DateTimeFormat(undefined, {
                              month: "short",
                              day: "numeric",
                            }).format(new Date(attempt.createdAt))}
                          </time>
                        </li>
                      );
                    })}
                </ol>
              )}
            </section>
          </section>
        ) : null}
      </main>

      {resetOpen ? (
        <div className="dialog-backdrop">
          <section
            className="reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-description"
          >
            <p className="section-index">Reset progress</p>
            <h2 id="reset-title">Erase this memory trace?</h2>
            <p id="reset-description">
              This permanently clears attempts, unresolved misses, and miss history
              stored in this browser.
            </p>
            <div className="dialog-actions">
              <button
                className="button button-quiet"
                type="button"
                ref={resetCancelRef}
                onClick={() => setResetOpen(false)}
              >
                Keep progress
              </button>
              <button className="button button-danger" type="button" onClick={confirmReset}>
                Reset everything
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

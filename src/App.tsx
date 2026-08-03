import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { MemoryTrace } from "./components/MemoryTrace";
import { PracticeView } from "./components/PracticeView";
import { ReviewView } from "./components/ReviewView";
import {
  fetchQuestionDetail,
  gradeResponse,
  loadCatalog,
} from "./lib/qbank";
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
  QuestionDetail,
  QuestionMeta,
  ViewMode,
} from "./types";

const DEFAULT_FILTERS: Filters = {
  subject: "All",
  domain: "All",
  skill: "All",
  difficulty: "All",
  mode: "all",
};

const memoryFallback = new Map<string, string>();
const memoryStorage: StorageLike = {
  getItem: (key) => memoryFallback.get(key) ?? null,
  setItem: (key, value) => {
    memoryFallback.set(key, value);
  },
};

type CatalogStatus = "loading" | "ready" | "error";
type DetailState =
  | { status: "idle" }
  | { status: "loading"; questionId: string }
  | { status: "error"; questionId: string }
  | { status: "ready"; questionId: string; question: QuestionDetail };

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

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

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
  const storageRef = useRef<StorageLike>(resolveStorage());
  const catalogControllerRef = useRef<AbortController | null>(null);
  const catalogVersionRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);
  const detailVersionRef = useRef(0);

  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [catalog, setCatalog] = useState<QuestionMeta[]>([]);
  const [practiceState, setPracticeState] = useState<PracticeState>(
    initialPracticeState,
  );
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("practice");
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [questionEpoch, setQuestionEpoch] = useState(0);
  const [detailRetry, setDetailRetry] = useState(0);
  const [detailState, setDetailState] = useState<DetailState>({ status: "idle" });
  const [resetOpen, setResetOpen] = useState(false);
  const resetCancelRef = useRef<HTMLButtonElement>(null);

  const startCatalogLoad = useCallback(() => {
    catalogControllerRef.current?.abort();
    detailControllerRef.current?.abort();
    const controller = new AbortController();
    const version = catalogVersionRef.current + 1;
    catalogVersionRef.current = version;
    catalogControllerRef.current = controller;
    setCatalogStatus("loading");

    void loadCatalog(controller.signal)
      .then((nextCatalog) => {
        if (controller.signal.aborted || catalogVersionRef.current !== version) {
          return;
        }

        setCatalog(nextCatalog);
        setPracticeState(loadPracticeState(storageRef.current, nextCatalog));
        setCurrentQuestionId(nextCatalog[0]?.id ?? null);
        setQuestionEpoch((epoch) => epoch + 1);
        setCatalogStatus("ready");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setCatalogStatus("error");
        }
      });
  }, []);

  useEffect(() => {
    startCatalogLoad();
    return () => {
      catalogVersionRef.current += 1;
      detailVersionRef.current += 1;
      catalogControllerRef.current?.abort();
      detailControllerRef.current?.abort();
    };
  }, [startCatalogLoad]);

  const questionById = useMemo(
    () => new Map(catalog.map((question) => [question.id, question])),
    [catalog],
  );
  const pool = useMemo(
    () => filterQuestions(catalog, filters, practiceState),
    [catalog, filters, practiceState],
  );
  const stats = useMemo(
    () => deriveTopicStats(catalog, practiceState.attempts),
    [catalog, practiceState.attempts],
  );
  const currentMeta = currentQuestionId
    ? (questionById.get(currentQuestionId) ?? null)
    : null;
  const streak = countStreak(practiceState.attempts);

  useEffect(() => {
    detailControllerRef.current?.abort();
    const meta = currentMeta;
    if (catalogStatus !== "ready" || !meta) {
      setDetailState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const version = detailVersionRef.current + 1;
    detailVersionRef.current = version;
    detailControllerRef.current = controller;
    setDetailState({ status: "loading", questionId: meta.id });

    void fetchQuestionDetail(meta, controller.signal)
      .then((question) => {
        if (
          controller.signal.aborted ||
          detailVersionRef.current !== version ||
          question.id !== meta.id
        ) {
          return;
        }
        setDetailState({ status: "ready", questionId: meta.id, question });
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !isAbortError(error) &&
          detailVersionRef.current === version
        ) {
          setDetailState({ status: "error", questionId: meta.id });
        }
      });

    return () => controller.abort();
  }, [catalogStatus, currentMeta, detailRetry]);

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
    const nextPool = filterQuestions(catalog, nextFilters, state);
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

  const submitAnswer = (response: string): boolean => {
    if (detailState.status !== "ready") {
      return false;
    }

    const correct = gradeResponse(detailState.question, response);
    const attempt: Attempt = {
      id: nextAttemptId(detailState.question.id),
      questionId: detailState.question.id,
      response,
      correct,
      createdAt: new Date().toISOString(),
    };
    const nextState = recordAttempt(practiceState, attempt);
    setPracticeState(nextState);
    savePracticeState(storageRef.current, nextState);
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
    savePracticeState(storageRef.current, nextState);
    setResetOpen(false);
    setView("practice");
    setFilters(DEFAULT_FILTERS);
    choosePoolStart(DEFAULT_FILTERS, nextState);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="wordmark" type="button" onClick={practiceAll}>
          <span className="wordmark-mark" aria-hidden="true">S</span>
          <span>SAT <strong>Signal</strong></span>
        </button>

        <nav className="primary-nav" aria-label="Primary navigation">
          {(["practice", "review", "memory"] as const).map((item) => (
            <button
              type="button"
              className={view === item ? "is-active" : ""}
              aria-current={view === item ? "page" : undefined}
              key={item}
              onClick={() => setView(item)}
              disabled={catalogStatus !== "ready"}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="header-progress">
          <span className="streak"><i aria-hidden="true" />{streak} day streak</span>
          <button
            className="reset-trigger"
            type="button"
            disabled={catalogStatus !== "ready"}
            onClick={() => setResetOpen(true)}
          >
            Reset
          </button>
        </div>
      </header>

      <main>
        {catalogStatus === "loading" ? (
          <section className="service-state" aria-live="polite">
            <span className="loading-pulse" aria-hidden="true" />
            <p className="section-index">Connecting to the live bank</p>
            <h1>Loading released SAT questions…</h1>
            <p>Fetching the current College Board catalog. Your saved progress stays in this browser.</p>
          </section>
        ) : null}

        {catalogStatus === "error" ? (
          <section className="service-state" role="alert">
            <div className="empty-mark" aria-hidden="true">↻</div>
            <p className="section-index">Question bank unavailable</p>
            <h1>We could not reach College Board.</h1>
            <p>The live service may be temporarily unavailable. Nothing in your saved progress was changed.</p>
            <button className="button button-primary" type="button" onClick={startCatalogLoad}>
              Try again
            </button>
          </section>
        ) : null}

        {catalogStatus === "ready" && catalog.length === 0 ? (
          <section className="service-state" role="status">
            <p className="section-index">Live bank connected</p>
            <h1>No eligible released questions were returned.</h1>
            <button className="button button-primary" type="button" onClick={startCatalogLoad}>
              Refresh catalog
            </button>
          </section>
        ) : null}

        {catalogStatus === "ready" && catalog.length > 0 && view === "practice" ? (
          <>
            <FilterBar
              filters={filters}
              questions={catalog}
              unresolvedCount={practiceState.unresolvedIds.length}
              onChange={changeFilters}
            />
            <PracticeView
              key={`${currentQuestionId ?? "empty"}-${questionEpoch}`}
              currentMeta={currentMeta}
              detailState={detailState}
              pool={pool}
              stats={stats}
              unresolvedCount={practiceState.unresolvedIds.length}
              attemptedCount={practiceState.attempts.length}
              focusQuestion={questionEpoch > 1}
              onSubmit={submitAnswer}
              onNext={nextQuestion}
              onRetryDetail={() => setDetailRetry((retry) => retry + 1)}
              onPracticeAll={practiceAll}
            />
          </>
        ) : null}

        {catalogStatus === "ready" && catalog.length > 0 && view === "review" ? (
          <ReviewView
            questions={catalog}
            state={practiceState}
            onPracticeMisses={practiceMisses}
            onPracticeAll={practiceAll}
          />
        ) : null}

        {catalogStatus === "ready" && catalog.length > 0 && view === "memory" ? (
          <section className="view-page memory-page" aria-labelledby="memory-title">
            <header className="view-intro memory-intro">
              <div>
                <p className="section-index">Memory</p>
                <h1 id="memory-title">See the work become a pattern.</h1>
                <p>Length shows accuracy. The dot rhythm tightens as attempts accumulate, so one lucky answer never looks like mastery.</p>
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
                <p className="review-empty">Your most recent answers will appear here after the first check.</p>
              ) : (
                <ol>
                  {practiceState.attempts.slice(-6).reverse().map((attempt) => {
                    const question = questionById.get(attempt.questionId);
                    return (
                      <li key={attempt.id}>
                        <span className={attempt.correct ? "activity-correct" : "activity-missed"}>
                          {attempt.correct ? "Correct" : "Missed"}
                        </span>
                        <strong>{question?.domain ?? "Unknown topic"}</strong>
                        <span>{question?.skill ?? "Question removed"}</span>
                        <time dateTime={attempt.createdAt}>
                          {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(attempt.createdAt))}
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

      {catalogStatus === "ready" && catalog.length > 0 ? (
        <footer className="source-footer">
          <span><strong>{catalog.length.toLocaleString()}</strong> eligible released questions live</span>
          <span aria-hidden="true">·</span>
          <a href="https://satsuitequestionbank.collegeboard.org/" target="_blank" rel="noreferrer">
            Content from College Board Question Bank
          </a>
          <span>Unofficial personal interface</span>
        </footer>
      ) : null}

      {resetOpen ? (
        <div className="dialog-backdrop">
          <section className="reset-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description">
            <p className="section-index">Reset progress</p>
            <h2 id="reset-title">Erase this memory trace?</h2>
            <p id="reset-description">This permanently clears attempts, unresolved misses, and miss history stored in this browser.</p>
            <div className="dialog-actions">
              <button className="button button-quiet" type="button" ref={resetCancelRef} onClick={() => setResetOpen(false)}>
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

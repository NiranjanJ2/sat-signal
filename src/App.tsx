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
  appendProgressAttempt,
  importProgressDocument,
  loadProgressDocument,
  progressGeneration,
  resetProgressDocument,
} from "./lib/progress";
import {
  hydratePracticeStateDocument,
  loadPracticeSnapshot,
  mergePracticeStates,
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

type DetailRequest = {
  controller: AbortController;
  promise: Promise<QuestionDetail>;
};

const DETAIL_CACHE_LIMIT = 3;

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

const rememberQuestionDetail = (
  cache: Map<string, QuestionDetail>,
  question: QuestionDetail,
) => {
  cache.delete(question.id);
  cache.set(question.id, question);

  while (cache.size > DETAIL_CACHE_LIMIT) {
    const oldestId = cache.keys().next().value;
    if (oldestId === undefined) {
      break;
    }
    cache.delete(oldestId);
  }
};

const nextQuestionInPool = (
  pool: readonly QuestionMeta[],
  currentQuestionId: string | null,
): QuestionMeta | undefined => {
  if (pool.length === 0) {
    return undefined;
  }

  const currentIndex = pool.findIndex(
    (question) => question.id === currentQuestionId,
  );
  const nextIndex =
    pool.length === 1 || currentIndex < 0 ? 0 : (currentIndex + 1) % pool.length;
  return pool[nextIndex];
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
  const storageRef = useRef<StorageLike>(resolveStorage());
  const catalogControllerRef = useRef<AbortController | null>(null);
  const catalogVersionRef = useRef(0);
  const detailVersionRef = useRef(0);
  const detailCacheRef = useRef(new Map<string, QuestionDetail>());
  const detailRequestsRef = useRef(new Map<string, DetailRequest>());
  const progressWritableRef = useRef(false);
  const progressGenerationRef = useRef<number | null>(null);
  const progressSaveRef = useRef<Promise<void>>(Promise.resolve());

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
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);

  const abortAllDetailRequests = useCallback(() => {
    for (const request of detailRequestsRef.current.values()) {
      request.controller.abort();
    }
    detailRequestsRef.current.clear();
  }, []);

  const queueProgressOperation = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = progressSaveRef.current.then(operation, operation);
    progressSaveRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const persistAttempt = useCallback(
    (state: PracticeState, attempt: Attempt) => {
      savePracticeState(
        storageRef.current,
        state,
        progressGenerationRef.current,
      );
      if (progressWritableRef.current) {
        void queueProgressOperation(() => appendProgressAttempt(attempt));
      }
    },
    [queueProgressOperation],
  );

  const requestQuestionDetail = useCallback((meta: QuestionMeta) => {
    const cachedQuestion = detailCacheRef.current.get(meta.id);
    if (cachedQuestion) {
      return Promise.resolve(cachedQuestion);
    }

    const pendingRequest = detailRequestsRef.current.get(meta.id);
    if (pendingRequest) {
      return pendingRequest.promise;
    }

    const controller = new AbortController();
    const promise = fetchQuestionDetail(meta, controller.signal)
      .then((question) => {
        if (!controller.signal.aborted && question.id === meta.id) {
          rememberQuestionDetail(detailCacheRef.current, question);
        }
        return question;
      })
      .finally(() => {
        const activeRequest = detailRequestsRef.current.get(meta.id);
        if (activeRequest?.promise === promise) {
          detailRequestsRef.current.delete(meta.id);
        }
      });

    detailRequestsRef.current.set(meta.id, { controller, promise });
    return promise;
  }, []);

  const startCatalogLoad = useCallback(() => {
    catalogControllerRef.current?.abort();
    abortAllDetailRequests();
    detailVersionRef.current += 1;
    detailCacheRef.current.clear();
    const controller = new AbortController();
    const version = catalogVersionRef.current + 1;
    catalogVersionRef.current = version;
    catalogControllerRef.current = controller;
    progressWritableRef.current = false;
    setCatalogStatus("loading");

    void Promise.all([
      loadCatalog(controller.signal),
      loadProgressDocument(controller.signal),
    ])
      .then(([nextCatalog, progressResult]) => {
        if (controller.signal.aborted || catalogVersionRef.current !== version) {
          return;
        }

        const browserSnapshot = loadPracticeSnapshot(
          storageRef.current,
          nextCatalog,
        );
        const serverGeneration = progressResult.available
          ? progressGeneration(progressResult.document)
          : null;
        const canMergeBrowser =
          serverGeneration !== null &&
          (browserSnapshot.generation === serverGeneration ||
            (serverGeneration === 0 && browserSnapshot.generation === null));
        const serverState = progressResult.available
          ? hydratePracticeStateDocument(progressResult.document, nextCatalog)
          : initialPracticeState();
        const nextPracticeState =
          serverGeneration === null
            ? browserSnapshot.state
            : canMergeBrowser
              ? mergePracticeStates(serverState, browserSnapshot.state)
              : serverState;
        const nextPool = filterQuestions(
          nextCatalog,
          DEFAULT_FILTERS,
          nextPracticeState,
        );

        progressWritableRef.current = serverGeneration !== null;
        progressGenerationRef.current =
          serverGeneration ?? browserSnapshot.generation;
        setCatalog(nextCatalog);
        setPracticeState(nextPracticeState);
        savePracticeState(
          storageRef.current,
          nextPracticeState,
          progressGenerationRef.current,
        );
        if (serverGeneration !== null && canMergeBrowser) {
          void queueProgressOperation(() =>
            importProgressDocument(nextPracticeState, serverGeneration),
          );
        }
        setCurrentQuestionId(nextPool[0]?.id ?? null);
        setQuestionEpoch((epoch) => epoch + 1);
        setCatalogStatus("ready");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setCatalogStatus("error");
        }
      });
  }, [abortAllDetailRequests, queueProgressOperation]);

  useEffect(() => {
    startCatalogLoad();
    return () => {
      catalogVersionRef.current += 1;
      detailVersionRef.current += 1;
      catalogControllerRef.current?.abort();
      abortAllDetailRequests();
    };
  }, [abortAllDetailRequests, startCatalogLoad]);

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
    const meta = currentMeta;
    if (catalogStatus !== "ready" || view !== "practice" || !meta) {
      setDetailState({ status: "idle" });
      return;
    }

    const cachedQuestion = detailCacheRef.current.get(meta.id);
    if (cachedQuestion) {
      setDetailState({
        status: "ready",
        questionId: meta.id,
        question: cachedQuestion,
      });
      return;
    }

    const version = detailVersionRef.current + 1;
    detailVersionRef.current = version;
    let active = true;
    setDetailState({ status: "loading", questionId: meta.id });

    void requestQuestionDetail(meta)
      .then((question) => {
        if (
          !active ||
          detailVersionRef.current !== version ||
          question.id !== meta.id
        ) {
          return;
        }
        setDetailState({ status: "ready", questionId: meta.id, question });
      })
      .catch((error: unknown) => {
        if (
          active &&
          !isAbortError(error) &&
          detailVersionRef.current === version
        ) {
          setDetailState({ status: "error", questionId: meta.id });
        }
      });

    return () => {
      active = false;
    };
  }, [catalogStatus, currentMeta, detailRetry, requestQuestionDetail, view]);

  useEffect(() => {
    if (catalogStatus !== "ready" || view !== "practice" || !currentMeta) {
      abortAllDetailRequests();
      return;
    }

    const nextMeta = nextQuestionInPool(pool, currentQuestionId);
    const desiredIds = new Set([currentMeta.id]);
    if (nextMeta && nextMeta.id !== currentMeta.id) {
      desiredIds.add(nextMeta.id);
    }

    for (const [questionId, request] of detailRequestsRef.current) {
      if (!desiredIds.has(questionId)) {
        request.controller.abort();
        detailRequestsRef.current.delete(questionId);
      }
    }

    void requestQuestionDetail(currentMeta).catch(() => {});
    if (nextMeta && nextMeta.id !== currentMeta.id) {
      void requestQuestionDetail(nextMeta).catch(() => {
        // Lookahead is opportunistic; the current-detail path retries on demand.
      });
    }
  }, [
    abortAllDetailRequests,
    catalogStatus,
    currentMeta,
    currentQuestionId,
    pool,
    requestQuestionDetail,
    view,
  ]);

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

  const activateQuestion = (question: QuestionMeta | undefined) => {
    const questionId = question?.id ?? null;
    const cachedQuestion = questionId
      ? detailCacheRef.current.get(questionId)
      : undefined;

    setCurrentQuestionId(questionId);
    if (cachedQuestion) {
      setDetailState({
        status: "ready",
        questionId: cachedQuestion.id,
        question: cachedQuestion,
      });
    } else if (!questionId) {
      setDetailState({ status: "idle" });
    }
    setQuestionEpoch((epoch) => epoch + 1);
  };

  const choosePoolStart = (nextFilters: Filters, state = practiceState) => {
    const nextPool = filterQuestions(catalog, nextFilters, state);
    activateQuestion(nextPool[0]);
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
    persistAttempt(nextState, attempt);
    return correct;
  };

  const nextQuestion = () => {
    activateQuestion(nextQuestionInPool(pool, currentQuestionId));
  };

  const confirmReset = async () => {
    setResetSaving(true);
    setResetError(null);
    const result = await queueProgressOperation(resetProgressDocument);
    const nextGeneration = result.available
      ? progressGeneration(result.document)
      : null;
    if (nextGeneration === null) {
      setResetSaving(false);
      setResetError("Progress could not be reset on disk. Nothing was erased; try again.");
      return;
    }

    const nextState = initialPracticeState();
    progressWritableRef.current = true;
    progressGenerationRef.current = nextGeneration;
    setPracticeState(nextState);
    savePracticeState(storageRef.current, nextState, nextGeneration);
    setResetSaving(false);
    setResetOpen(false);
    setView("practice");
    setFilters(DEFAULT_FILTERS);
    choosePoolStart(DEFAULT_FILTERS, nextState);
  };

  const changeView = (nextView: ViewMode) => {
    if (
      nextView === "practice" &&
      view !== "practice" &&
      !pool.some((question) => question.id === currentQuestionId)
    ) {
      activateQuestion(pool[0]);
    }
    setView(nextView);
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
              onClick={() => changeView(item)}
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
            onClick={() => {
              setResetError(null);
              setResetOpen(true);
            }}
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
            <p>Fetching the current College Board catalog. Your saved progress stays on this device.</p>
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
              queueMode={filters.mode}
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
            <p id="reset-description">This permanently clears attempts, unresolved misses, and miss history stored on this device.</p>
            {resetError ? <p className="reset-error" role="alert">{resetError}</p> : null}
            <div className="dialog-actions">
              <button className="button button-quiet" type="button" ref={resetCancelRef} disabled={resetSaving} onClick={() => setResetOpen(false)}>
                Keep progress
              </button>
              <button className="button button-danger" type="button" disabled={resetSaving} onClick={() => void confirmReset()}>
                {resetSaving ? "Resetting…" : "Reset everything"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

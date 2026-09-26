import { useCallback, useEffect, useRef, useState } from "react";
import { gradeResponse } from "../lib/qbank";
import type { Filters, QuestionDetail, QuestionMeta, TopicStat } from "../types";
import {
  DesmosPanel,
  isCalculatorOpen,
  rememberCalculatorOpen,
} from "./DesmosPanel";
import { MemoryTrace } from "./MemoryTrace";
import { RichHtml } from "./RichHtml";

type DetailState =
  | { status: "idle" }
  | { status: "loading"; questionId: string }
  | { status: "error"; questionId: string }
  | { status: "ready"; questionId: string; question: QuestionDetail };

type PracticeViewProps = {
  currentMeta: QuestionMeta | null;
  detailState: DetailState;
  pool: readonly QuestionMeta[];
  stats: readonly TopicStat[];
  unresolvedCount: number;
  attemptedCount: number;
  queueMode: Filters["mode"];
  focusQuestion: boolean;
  onSubmit: (response: string, durationMs: number) => boolean;
  onNext: () => void;
  onRetryDetail: () => void;
  onPracticeAll: () => void;
};

const sectionName = (question: QuestionMeta): string =>
  question.section === "math" ? "Math" : "Reading & Writing";

const acceptedAnswerText = (question: QuestionDetail): string =>
  question.correctAnswers.length === 1
    ? question.correctAnswers[0] ?? "Unavailable"
    : question.correctAnswers.join(", ");

const formatElapsed = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function PracticeView({
  currentMeta,
  detailState,
  pool,
  stats,
  unresolvedCount,
  attemptedCount,
  queueMode,
  focusQuestion,
  onSubmit,
  onNext,
  onRetryDetail,
  onPracticeAll,
}: PracticeViewProps) {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(isCalculatorOpen);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusQuestion && detailState.status === "ready") {
      headingRef.current?.focus();
    }
  }, [detailState.status, focusQuestion]);

  useEffect(() => {
    if (detailState.status !== "ready" || submitted) {
      return;
    }

    startedAtRef.current ??= Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current!) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [detailState.status, submitted]);

  const toggleCalculator = (open: boolean) => {
    rememberCalculatorOpen(open);
    setCalculatorOpen(open);
  };

  const checkAnswer = useCallback(() => {
    const cleanResponse = response.trim();
    if (!cleanResponse || submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    const durationMs = Math.max(0, Date.now() - (startedAtRef.current ?? Date.now()));
    setElapsedSeconds(Math.floor(durationMs / 1000));
    setCorrect(onSubmit(cleanResponse, durationMs));
    setSubmitted(true);
  }, [onSubmit, response]);

  useEffect(() => {
    if (detailState.status !== "ready") {
      return;
    }

    const advanceOnEnter = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      // Buttons and links already activate on Enter, and the calculator keypad
      // needs Enter for entering expressions.
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, textarea, .calculator-panel")) {
        return;
      }

      event.preventDefault();
      if (submittedRef.current) {
        onNext();
      } else {
        checkAnswer();
      }
    };

    window.addEventListener("keydown", advanceOnEnter);
    return () => window.removeEventListener("keydown", advanceOnEnter);
  }, [checkAnswer, detailState.status, onNext]);

  if (!currentMeta) {
    const retryMode = queueMode === "missed";
    return (
      <section className="empty-state" aria-labelledby="empty-pool-title">
        <div className="empty-mark" aria-hidden="true">✓</div>
        <p className="section-index">No question waiting</p>
        <h1 id="empty-pool-title">
          {retryMode
            ? "The retry queue is clear."
            : "You have seen every question in this filter."}
        </h1>
        <p>
          {retryMode
            ? "You have resolved every miss in this filter. Return to the unseen bank to build another signal."
            : "Change the filters, practice unresolved misses, or reset progress to start the bank over."}
        </p>
        <button className="button button-primary" type="button" onClick={onPracticeAll}>
          Practice new questions
        </button>
      </section>
    );
  }

  const currentIndex = pool.findIndex((question) => question.id === currentMeta.id);
  const position = currentIndex >= 0 ? currentIndex + 1 : null;

  const detailMatches =
    detailState.status !== "idle" && detailState.questionId === currentMeta.id;

  if (
    !detailMatches ||
    detailState.status === "loading"
  ) {
    return (
      <article className="practice-surface question-loading" aria-busy="true" aria-live="polite">
        <header className="question-meta">
          <div>
            <p className="section-index">{sectionName(currentMeta)} · {currentMeta.difficulty}</p>
            <p className="skill-name">{currentMeta.skill}</p>
          </div>
          <span className="queue-position">Loading question</span>
        </header>
        <div className="question-loading-body">
          <span className="loading-pulse" aria-hidden="true" />
          <h1>Fetching this question…</h1>
          <p>Question content is loaded on demand from College Board.</p>
        </div>
      </article>
    );
  }

  if (detailState.status === "error") {
    return (
      <article className="practice-surface question-loading" role="alert">
        <header className="question-meta">
          <div>
            <p className="section-index">{sectionName(currentMeta)} · {currentMeta.difficulty}</p>
            <p className="skill-name">{currentMeta.skill}</p>
          </div>
          <span className="queue-position">Could not load</span>
        </header>
        <div className="question-loading-body">
          <div className="empty-mark" aria-hidden="true">↻</div>
          <h1>This question did not arrive.</h1>
          <p>The catalog is still available. Retry only this question without losing your place.</p>
          <div className="question-error-actions">
            <button className="button button-primary" type="button" onClick={onRetryDetail}>
              Retry question
            </button>
            <button className="button button-quiet" type="button" onClick={onNext}>
              Skip for now
            </button>
          </div>
        </div>
      </article>
    );
  }

  const question = detailState.question;

  return (
    <>
      <article className="practice-surface" aria-labelledby="question-title">
        <header className="question-meta">
          <div>
            <p className="section-index">{sectionName(question)} · {question.difficulty}</p>
            <p className="skill-name">{question.skill}</p>
          </div>
          <div className="question-meta-actions">
            <span className="question-stopwatch" aria-label={`Time on question ${formatElapsed(elapsedSeconds)}`}>
              <span aria-hidden="true">◷</span> {formatElapsed(elapsedSeconds)}
            </span>
            {question.section === "math" ? (
              <button
                className="button button-quiet calculator-toggle"
                type="button"
                aria-expanded={calculatorOpen}
                aria-controls={calculatorOpen ? "desmos-host" : undefined}
                onClick={() => toggleCalculator(!calculatorOpen)}
              >
                <span aria-hidden="true">∿</span>
                {calculatorOpen ? "Hide calculator" : "Graphing calculator"}
              </button>
            ) : null}
            <span className="queue-position">
              {position === null ? "Retry answered" : `Question ${position} of ${pool.length}`}
            </span>
          </div>
        </header>

        <div className={`question-layout${question.stimulusHtml ? " has-passage" : ""}`}>
          {question.stimulusHtml ? (
            <section className="passage-pane" aria-labelledby="passage-title">
              <h2 id="passage-title" className="section-index">Read this</h2>
              <RichHtml html={question.stimulusHtml} className="service-rich-text passage-content" />
            </section>
          ) : null}

          <section className="answer-pane">
            <div id="question-title" className="question-title" role="heading" aria-level={1} ref={headingRef} tabIndex={-1}>
              <RichHtml html={question.promptHtml} className="service-rich-text" />
            </div>

            <form onSubmit={(event) => { event.preventDefault(); checkAnswer(); }}>
              {question.kind === "multiple-choice" ? (
                <fieldset className="answer-list" disabled={submitted}>
                  <legend>Choose the best answer</legend>
                  {question.choices.map((choice) => {
                    const isCorrectAnswer = submitted && gradeResponse(question, choice.label);
                    const isWrongSelection = submitted && response === choice.label && !isCorrectAnswer;
                    const stateClass = isCorrectAnswer ? " is-correct" : isWrongSelection ? " is-incorrect" : "";

                    return (
                      <label className={`answer-option${stateClass}`} key={choice.id}>
                        <input
                          type="radio"
                          name={`answer-${question.id}`}
                          value={choice.label}
                          checked={response === choice.label}
                          onChange={() => setResponse(choice.label)}
                        />
                        <span className="answer-letter" aria-hidden="true">{choice.label}</span>
                        <RichHtml html={choice.html} className="answer-copy service-rich-text" />
                        {isCorrectAnswer ? <span className="answer-state">Correct answer</span> : null}
                        {isWrongSelection ? <span className="answer-state">Your answer</span> : null}
                      </label>
                    );
                  })}
                </fieldset>
              ) : (
                <fieldset className="spr-answer" disabled={submitted}>
                  <legend>Enter your answer</legend>
                  <label htmlFor={`answer-${question.id}`}>Student-produced response</label>
                  <input
                    id={`answer-${question.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={response}
                    onChange={(event) => setResponse(event.target.value)}
                    placeholder="Type a number, decimal, or fraction"
                  />
                </fieldset>
              )}

              {!submitted ? (
                <div className="question-actions">
                  <button className="button button-primary" type="submit" disabled={!response.trim()}>
                    Check answer
                  </button>
                  <span className="keyboard-hint">
                    Enter checks · {question.kind === "multiple-choice" ? "arrow keys move choices" : "fractions such as 3/4 are accepted"}
                  </span>
                </div>
              ) : (
                <div className={`feedback${correct ? " is-correct" : " is-incorrect"}`}>
                  <div className="feedback-heading" role="status" aria-live="polite">
                    <span className="feedback-icon" aria-hidden="true">{correct ? "✓" : "↗"}</span>
                    <strong>{correct ? "Correct." : "Not quite."}</strong>
                  </div>
                  <p className="accepted-answer"><strong>Accepted answer:</strong> {acceptedAnswerText(question)}</p>
                  {question.rationaleHtml ? (
                    <div className="official-rationale">
                      <p className="section-index">College Board rationale</p>
                      <RichHtml html={question.rationaleHtml} className="service-rich-text" />
                    </div>
                  ) : null}
                  <div className="feedback-actions">
                    <button className="button button-primary" type="button" onClick={onNext}>
                      Next question <span className="key-cap" aria-hidden="true">↵</span>
                    </button>
                    <span>{correct ? "This topic just got a little stronger." : "This question is now in your retry queue."}</span>
                  </div>
                </div>
              )}
            </form>
          </section>
        </div>

        {question.section === "math" && calculatorOpen ? (
          <DesmosPanel onClose={() => toggleCalculator(false)} />
        ) : null}
      </article>

      <div className="practice-lower-grid">
        <section className="queue-context" aria-labelledby="queue-context-title">
          <p className="section-index">Queue context</p>
          <h2 id="queue-context-title">Keep the loop small.</h2>
          <p>
            {pool.length} {pool.length === 1 ? "question matches" : "questions match"}
            {" · "}{unresolvedCount} {unresolvedCount === 1 ? "open miss" : "open misses"}
            {" · "}{attemptedCount} {attemptedCount === 1 ? "attempt" : "attempts"} saved
          </p>
          <div className="queue-rule" aria-hidden="true"><span /><span /><span /></div>
        </section>
        <MemoryTrace stats={stats} compact headingLevel="h2" />
      </div>
    </>
  );
}

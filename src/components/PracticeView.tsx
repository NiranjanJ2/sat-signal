import { useEffect, useRef, useState } from "react";
import { gradeResponse } from "../lib/qbank";
import type { QuestionDetail, QuestionMeta, TopicStat } from "../types";
import { CoachPanel } from "./CoachPanel";
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
  focusQuestion: boolean;
  onSubmit: (response: string) => boolean;
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

export function PracticeView({
  currentMeta,
  detailState,
  pool,
  stats,
  unresolvedCount,
  attemptedCount,
  focusQuestion,
  onSubmit,
  onNext,
  onRetryDetail,
  onPracticeAll,
}: PracticeViewProps) {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const submittedRef = useRef(false);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusQuestion && detailState.status === "ready") {
      headingRef.current?.focus();
    }
  }, [detailState.status, focusQuestion]);

  if (!currentMeta) {
    return (
      <section className="empty-state" aria-labelledby="empty-pool-title">
        <div className="empty-mark" aria-hidden="true">✓</div>
        <p className="section-index">No question waiting</p>
        <h1 id="empty-pool-title">The retry queue is clear.</h1>
        <p>You have resolved every miss in this filter. Return to the full bank to build another signal.</p>
        <button className="button button-primary" type="button" onClick={onPracticeAll}>
          Practice all questions
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
  const handleSubmit = () => {
    const cleanResponse = response.trim();
    if (!cleanResponse || submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    const result = onSubmit(cleanResponse);
    setCorrect(result);
    setSubmitted(true);
  };

  return (
    <>
      <article className="practice-surface" aria-labelledby="question-title">
        <header className="question-meta">
          <div>
            <p className="section-index">{sectionName(question)} · {question.difficulty}</p>
            <p className="skill-name">{question.skill}</p>
          </div>
          <span className="queue-position">
            {position === null ? "Retry answered" : `Question ${position} of ${pool.length}`}
          </span>
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

            <form onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
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
                    {question.kind === "multiple-choice" ? "Use arrow keys to move choices" : "Fractions such as 3/4 are accepted"}
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
                    <button className="button button-primary" type="button" onClick={onNext}>Next question</button>
                    <span>{correct ? "This topic just got a little stronger." : "This question is now in your retry queue."}</span>
                  </div>
                </div>
              )}
            </form>
          </section>
        </div>

        {submitted ? (
          <CoachPanel
            key={`${question.id}-${response}`}
            question={question}
            response={response}
            autoStart={!correct}
          />
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

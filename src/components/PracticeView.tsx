import { useEffect, useRef, useState } from "react";
import type { Question, TopicStat } from "../types";
import { CoachPanel } from "./CoachPanel";
import { MemoryTrace } from "./MemoryTrace";

type PracticeViewProps = {
  currentQuestion: Question | null;
  pool: readonly Question[];
  stats: readonly TopicStat[];
  unresolvedCount: number;
  attemptedCount: number;
  focusQuestion: boolean;
  onSubmit: (selectedIndex: number) => boolean;
  onNext: () => void;
  onPracticeAll: () => void;
};

const answerLabels = ["A", "B", "C", "D"] as const;

const sectionName = (question: Question): string =>
  question.section === "math" ? "Math" : "Reading & Writing";

export function PracticeView({
  currentQuestion,
  pool,
  stats,
  unresolvedCount,
  attemptedCount,
  focusQuestion,
  onSubmit,
  onNext,
  onPracticeAll,
}: PracticeViewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const submittedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusQuestion) {
      headingRef.current?.focus();
    }
  }, [focusQuestion]);

  if (!currentQuestion) {
    return (
      <section className="empty-state" aria-labelledby="empty-pool-title">
        <div className="empty-mark" aria-hidden="true">
          ✓
        </div>
        <p className="section-index">No question waiting</p>
        <h1 id="empty-pool-title">The retry queue is clear.</h1>
        <p>
          You have resolved every miss in this filter. Return to the full bank
          to build another signal.
        </p>
        <button className="button button-primary" type="button" onClick={onPracticeAll}>
          Practice all questions
        </button>
      </section>
    );
  }

  const currentIndex = pool.findIndex(
    (question) => question.id === currentQuestion.id,
  );
  const position = currentIndex >= 0 ? currentIndex + 1 : null;

  const handleSubmit = () => {
    if (selectedIndex === null || submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    const result = onSubmit(selectedIndex);
    setCorrect(result);
    setSubmitted(true);
  };

  return (
    <>
      <article className="practice-surface" aria-labelledby="question-title">
        <header className="question-meta">
          <div>
            <p className="section-index">
              {sectionName(currentQuestion)} · {currentQuestion.difficulty}
            </p>
            <p className="skill-name">{currentQuestion.skill}</p>
          </div>
          <span className="queue-position">
            {position === null
              ? "Retry answered"
              : `Question ${position} of ${pool.length}`}
          </span>
        </header>

        <div
          className={`question-layout${currentQuestion.passage ? " has-passage" : ""}`}
        >
          {currentQuestion.passage ? (
            <section className="passage-pane" aria-labelledby="passage-title">
              <h2 id="passage-title" className="section-index">
                Read this
              </h2>
              <p>{currentQuestion.passage}</p>
            </section>
          ) : null}

          <section className="answer-pane">
            <h1 id="question-title" ref={headingRef} tabIndex={-1}>
              {currentQuestion.prompt}
            </h1>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <fieldset className="answer-list" disabled={submitted}>
                <legend>Choose the best of 4 answers</legend>
                {currentQuestion.choices.map((choice, index) => {
                  const isCorrectAnswer =
                    submitted && index === currentQuestion.answerIndex;
                  const isWrongSelection =
                    submitted && selectedIndex === index && !isCorrectAnswer;
                  const stateClass = isCorrectAnswer
                    ? " is-correct"
                    : isWrongSelection
                      ? " is-incorrect"
                      : "";

                  return (
                    <label className={`answer-option${stateClass}`} key={choice}>
                      <input
                        type="radio"
                        name={`answer-${currentQuestion.id}`}
                        value={index}
                        checked={selectedIndex === index}
                        onChange={() => setSelectedIndex(index)}
                      />
                      <span className="answer-letter" aria-hidden="true">
                        {answerLabels[index]}
                      </span>
                      <span className="answer-copy">{choice}</span>
                      {isCorrectAnswer ? (
                        <span className="answer-state">Correct answer</span>
                      ) : null}
                      {isWrongSelection ? (
                        <span className="answer-state">Your answer</span>
                      ) : null}
                    </label>
                  );
                })}
              </fieldset>

              {!submitted ? (
                <div className="question-actions">
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={selectedIndex === null}
                  >
                    Check answer
                  </button>
                  <span className="keyboard-hint">Use arrow keys to move choices</span>
                </div>
              ) : (
                <div className={`feedback${correct ? " is-correct" : " is-incorrect"}`}>
                  <div className="feedback-heading" role="status" aria-live="polite">
                    <span className="feedback-icon" aria-hidden="true">
                      {correct ? "✓" : "↗"}
                    </span>
                    <strong>{correct ? "Correct." : "Not quite."}</strong>
                  </div>
                  {correct ? <p>{currentQuestion.explanation}</p> : null}
                  <div className="feedback-actions">
                    <button className="button button-primary" type="button" onClick={onNext}>
                      Next question
                    </button>
                    <span>
                      {correct
                        ? "This topic just got a little stronger."
                        : "This question is now in your retry queue."}
                    </span>
                  </div>
                </div>
              )}
            </form>
          </section>
        </div>

        {submitted && selectedIndex !== null ? (
          <CoachPanel
            key={`${currentQuestion.id}-${selectedIndex}`}
            question={currentQuestion}
            selectedIndex={selectedIndex}
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
            {" · "}
            {unresolvedCount} {unresolvedCount === 1 ? "open miss" : "open misses"}
            {" · "}
            {attemptedCount} {attemptedCount === 1 ? "attempt" : "attempts"} saved
          </p>
          <div className="queue-rule" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
        <MemoryTrace stats={stats} compact headingLevel="h2" />
      </div>
    </>
  );
}

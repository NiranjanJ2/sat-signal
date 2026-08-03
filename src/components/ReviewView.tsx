import type { PracticeState, QuestionMeta } from "../types";

type ReviewViewProps = {
  questions: readonly QuestionMeta[];
  state: PracticeState;
  onPracticeMisses: () => void;
  onPracticeAll: () => void;
};

type ReviewListProps = {
  ids: readonly string[];
  questionsById: ReadonlyMap<string, QuestionMeta>;
  emptyText: string;
  unresolvedIds: ReadonlySet<string>;
};

function ReviewList({
  ids,
  questionsById,
  emptyText,
  unresolvedIds,
}: ReviewListProps) {
  if (ids.length === 0) {
    return <p className="review-empty">{emptyText}</p>;
  }

  return (
    <ol className="review-list">
      {ids.map((id) => {
        const question = questionsById.get(id);
        if (!question) {
          return null;
        }

        const unresolved = unresolvedIds.has(id);
        return (
          <li key={id}>
            <span className={`review-dot${unresolved ? " is-open" : ""}`} aria-hidden="true" />
            <div className="review-question">
              <p>
                {question.section === "math" ? "Math" : "Reading & Writing"}
                {" · "}
                {question.domain}
              </p>
              <strong>{question.skill}</strong>
              <small>
                {question.difficulty[0]?.toUpperCase()}
                {question.difficulty.slice(1)} difficulty
              </small>
            </div>
            <span className="review-state">
              {unresolved ? "Still open" : "Resolved"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ReviewView({
  questions,
  state,
  onPracticeMisses,
  onPracticeAll,
}: ReviewViewProps) {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const unresolvedIds = new Set(state.unresolvedIds);

  return (
    <section className="view-page review-page" aria-labelledby="review-title">
      <header className="view-intro">
        <div>
          <p className="section-index">Review</p>
          <h1 id="review-title">Return to the ideas that slipped.</h1>
          <p>
            Open misses stay at the top. Resolved questions remain below so
            progress never erases the path that produced it.
          </p>
        </div>
        {state.unresolvedIds.length > 0 ? (
          <button className="button button-primary" type="button" onClick={onPracticeMisses}>
            Practice {state.unresolvedIds.length} unresolved
          </button>
        ) : (
          <button className="button button-quiet" type="button" onClick={onPracticeAll}>
            Practice new questions
          </button>
        )}
      </header>

      <section className="review-section" aria-labelledby="unresolved-title">
        <div className="review-section-heading">
          <h2 id="unresolved-title">Unresolved misses</h2>
          <span>{state.unresolvedIds.length.toString().padStart(2, "0")}</span>
        </div>
        <ReviewList
          ids={state.unresolvedIds}
          questionsById={questionsById}
          unresolvedIds={unresolvedIds}
          emptyText="No open misses. The retry queue is clear for now."
        />
      </section>

      <section className="review-section" aria-labelledby="history-title">
        <div className="review-section-heading">
          <h2 id="history-title">Ever missed</h2>
          <span>{state.missedHistoryIds.length.toString().padStart(2, "0")}</span>
        </div>
        <ReviewList
          ids={state.missedHistoryIds}
          questionsById={questionsById}
          unresolvedIds={unresolvedIds}
          emptyText="Missed questions will collect here without disappearing after you resolve them."
        />
      </section>
    </section>
  );
}

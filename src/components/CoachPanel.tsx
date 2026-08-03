import { useCallback, useEffect, useRef, useState } from "react";
import { localCoachSummary, requestCoachSummary } from "../lib/coach";
import type { QuestionDetail } from "../types";

type CoachPanelProps = {
  question: QuestionDetail;
  response: string;
  autoStart: boolean;
};

export function CoachPanel({ question, response, autoStart }: CoachPanelProps) {
  const [summary, setSummary] = useState(() =>
    localCoachSummary(question, response),
  );
  const [revealed, setRevealed] = useState(autoStart);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);

  const askCoach = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    controllerRef.current = controller;
    setRevealed(true);
    setLoading(true);

    void requestCoachSummary({ question, response }, controller.signal).then(
      (nextSummary) => {
        if (
          !controller.signal.aborted &&
          requestVersionRef.current === requestVersion
        ) {
          setSummary(nextSummary);
          setLoading(false);
        }
      },
      () => {
        if (
          !controller.signal.aborted &&
          requestVersionRef.current === requestVersion
        ) {
          setLoading(false);
        }
      },
    );
  }, [question, response]);

  useEffect(() => {
    if (autoStart) {
      askCoach();
    }

    return () => {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [askCoach, autoStart]);

  return (
    <aside className="coach-panel" aria-busy={loading}>
      <div className="coach-copy">
        <p className="section-index">AI coach recap</p>
        {revealed ? (
          <p className="coach-summary">{summary}</p>
        ) : (
          <p className="coach-invite">
            Want a shorter way into this question? Ask for a summary of the
            official rationale. It never changes your result.
          </p>
        )}
      </div>
      <button
        className="button button-quiet coach-button"
        type="button"
        disabled={loading}
        onClick={askCoach}
      >
        Explain this{loading ? <span aria-hidden="true">…</span> : null}
        {loading ? <span className="sr-only">, loading</span> : null}
      </button>
    </aside>
  );
}

import type { CSSProperties } from "react";
import type { TopicStat } from "../types";

type MemoryTraceProps = {
  stats: readonly TopicStat[];
  compact?: boolean;
  headingLevel?: "h2" | "h3";
};

const statusFor = (stat: TopicStat): string => {
  if (stat.accuracy === null) {
    return "Not started";
  }
  if (stat.accuracy >= 85) {
    return "Strong signal";
  }
  if (stat.accuracy >= 60) {
    return "Taking shape";
  }
  return "Needs another pass";
};

const subjectShort = (subject: TopicStat["subject"]): string =>
  subject === "math" ? "Math" : "R&W";

export function MemoryTrace({
  stats,
  compact = false,
  headingLevel = "h2",
}: MemoryTraceProps) {
  const Heading = headingLevel;

  return (
    <section
      className={`memory-trace${compact ? " memory-trace-compact" : ""}`}
      aria-labelledby={compact ? "memory-trace-compact-title" : "memory-trace-title"}
    >
      <div className="trace-heading-row">
        <div>
          <p className="section-index">Live memory trace</p>
          <Heading
            id={compact ? "memory-trace-compact-title" : "memory-trace-title"}
          >
            What is sticking
          </Heading>
        </div>
        <span className="trace-key" aria-hidden="true">
          accuracy →
        </span>
      </div>

      <div className="trace-list">
        {stats.map((stat) => {
          const accuracy = stat.accuracy ?? 0;
          const density = Math.max(7, 18 - Math.min(stat.attempted, 6) * 2);
          const style = {
            "--trace-accuracy": `${accuracy}%`,
            "--trace-density": `${density}px`,
          } as CSSProperties;

          return (
            <div
              className={`trace-row${stat.attempted === 0 ? " is-unstarted" : ""}`}
              data-testid={`topic-${stat.domain}`}
              key={`${stat.subject}-${stat.domain}`}
              style={style}
            >
              <div className="trace-fill" aria-hidden="true" />
              <div className="trace-topic">
                <span className="trace-subject">{subjectShort(stat.subject)}</span>
                <strong>{stat.domain}</strong>
              </div>
              <div className="trace-stat">
                <strong>{stat.accuracy === null ? "—" : `${stat.accuracy}%`}</strong>
                <span>
                  {stat.attempted} {stat.attempted === 1 ? "attempt" : "attempts"}
                </span>
              </div>
              <span className="trace-status">{statusFor(stat)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

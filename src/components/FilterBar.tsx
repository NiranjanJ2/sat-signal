import type { Filters, Question, Subject } from "../types";

type FilterBarProps = {
  filters: Filters;
  questions: readonly Question[];
  unresolvedCount: number;
  onChange: (filters: Filters) => void;
};

const subjectLabel = (subject: Subject): string =>
  subject === "math" ? "Math" : "Reading & Writing";

export function FilterBar({
  filters,
  questions,
  unresolvedCount,
  onChange,
}: FilterBarProps) {
  const domainOptions = Array.from(
    new Set(
      questions
        .filter(
          (question) =>
            filters.subject === "All" || question.section === filters.subject,
        )
        .map((question) => question.domain),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <section className="filter-rail" aria-label="Question filters">
      <div className="filter-scroll">
        <label className="filter-field">
          <span>Subject</span>
          <select
            value={filters.subject}
            onChange={(event) =>
              onChange({
                ...filters,
                subject: event.target.value as Filters["subject"],
                domain: "All",
              })
            }
          >
            <option value="All">All subjects</option>
            <option value="reading-writing">
              {subjectLabel("reading-writing")}
            </option>
            <option value="math">{subjectLabel("math")}</option>
          </select>
        </label>

        <label className="filter-field filter-field-domain">
          <span>Domain</span>
          <select
            value={filters.domain}
            onChange={(event) =>
              onChange({ ...filters, domain: event.target.value })
            }
          >
            <option value="All">All domains</option>
            {domainOptions.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Difficulty</span>
          <select
            value={filters.difficulty}
            onChange={(event) =>
              onChange({
                ...filters,
                difficulty: event.target.value as Filters["difficulty"],
              })
            }
          >
            <option value="All">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <div className="mode-switch" aria-label="Practice mode">
          <button
            type="button"
            className={filters.mode === "all" ? "is-active" : ""}
            aria-pressed={filters.mode === "all"}
            onClick={() => onChange({ ...filters, mode: "all" })}
          >
            All questions
          </button>
          <button
            type="button"
            className={filters.mode === "missed" ? "is-active" : ""}
            aria-pressed={filters.mode === "missed"}
            onClick={() => onChange({ ...filters, mode: "missed" })}
          >
            <span>Practice misses</span>
            <span className="mode-count">
              {unresolvedCount} unresolved
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

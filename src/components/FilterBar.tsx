import type { Filters, QuestionMeta, Subject } from "../types";

type FilterBarProps = {
  filters: Filters;
  questions: readonly QuestionMeta[];
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
  const subjectQuestions = questions.filter(
    (question) =>
      filters.subject === "All" || question.section === filters.subject,
  );
  const domainOptions = Array.from(
    new Set(subjectQuestions.map((question) => question.domain)),
  ).sort((a, b) => a.localeCompare(b));
  const skillOptions = Array.from(
    new Set(
      subjectQuestions
        .filter(
          (question) =>
            filters.domain === "All" || question.domain === filters.domain,
        )
        .map((question) => question.skill),
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
                skill: "All",
              })
            }
          >
            <option value="All">All subjects</option>
            <option value="reading-writing">{subjectLabel("reading-writing")}</option>
            <option value="math">{subjectLabel("math")}</option>
          </select>
        </label>

        <label className="filter-field filter-field-domain">
          <span>Domain</span>
          <select
            value={filters.domain}
            onChange={(event) =>
              onChange({ ...filters, domain: event.target.value, skill: "All" })
            }
          >
            <option value="All">All domains</option>
            {domainOptions.map((domain) => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </label>

        <label className="filter-field filter-field-skill">
          <span>Skill</span>
          <select
            value={filters.skill}
            onChange={(event) => onChange({ ...filters, skill: event.target.value })}
          >
            <option value="All">All skills</option>
            {skillOptions.map((skill) => (
              <option key={skill} value={skill}>{skill}</option>
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
            New questions
          </button>
          <button
            type="button"
            className={filters.mode === "missed" ? "is-active" : ""}
            aria-pressed={filters.mode === "missed"}
            onClick={() => onChange({ ...filters, mode: "missed" })}
          >
            <span>Practice misses</span>
            <span className="mode-count">{unresolvedCount} unresolved</span>
          </button>
        </div>
      </div>
    </section>
  );
}

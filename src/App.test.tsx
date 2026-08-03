import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { PRACTICE_STORAGE_KEY } from "./lib/storage";
import type { QuestionDetail, QuestionMeta } from "./types";

const qbankMocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  fetchQuestionDetail: vi.fn(),
}));

const coachMocks = vi.hoisted(() => ({
  requestCoachSummary: vi.fn(),
}));

vi.mock("./lib/qbank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/qbank")>();
  return {
    ...actual,
    loadCatalog: qbankMocks.loadCatalog,
    fetchQuestionDetail: qbankMocks.fetchQuestionDetail,
  };
});

vi.mock("./lib/coach", () => ({
  localCoachSummary: (question: QuestionDetail) =>
    `Local summary for ${question.skill}`,
  requestCoachSummary: coachMocks.requestCoachSummary,
}));

const catalog: QuestionMeta[] = [
  {
    id: "rw-1",
    externalId: "rw-1",
    section: "reading-writing",
    domainCode: "INI",
    domain: "Information and Ideas",
    skillCode: "CID",
    skill: "Central Ideas and Details",
    difficulty: "easy",
  },
  {
    id: "math-1",
    externalId: "math-1",
    section: "math",
    domainCode: "H",
    domain: "Algebra",
    skillCode: "LE",
    skill: "Linear equations",
    difficulty: "hard",
  },
];

const details: Record<string, QuestionDetail> = {
  "rw-1": {
    ...catalog[0]!,
    kind: "multiple-choice",
    stimulusHtml: "<p>Researchers compared two elevation-specific trends.</p>",
    promptHtml: "<p>Which choice best states the main idea?</p>",
    choices: [
      { id: "choice-a", label: "A", html: "<p>The trends are connected.</p>" },
      { id: "choice-b", label: "B", html: "<p>The trends are unrelated.</p>" },
      { id: "choice-c", label: "C", html: "<p>Only elevation matters.</p>" },
      { id: "choice-d", label: "D", html: "<p>Nothing can be concluded.</p>" },
    ],
    correctAnswers: ["A"],
    rationaleHtml: "<p>The text links two elevation-specific trends.</p>",
  },
  "math-1": {
    ...catalog[1]!,
    kind: "student-produced-response",
    stimulusHtml: "",
    promptHtml: "<p>If <em>2x = 8</em>, what is the value of x?</p>",
    choices: [],
    correctAnswers: ["4", "4.0"],
    rationaleHtml: "<p>Divide both sides by 2.</p>",
  },
};

const prepareSuccess = () => {
  qbankMocks.loadCatalog.mockResolvedValue(catalog);
  qbankMocks.fetchQuestionDetail.mockImplementation((meta: QuestionMeta) =>
    Promise.resolve(details[meta.id]),
  );
  coachMocks.requestCoachSummary.mockResolvedValue("AI summary");
};

describe("SAT practice app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    qbankMocks.loadCatalog.mockReset();
    qbankMocks.fetchQuestionDetail.mockReset();
    coachMocks.requestCoachSummary.mockReset();
  });

  it("loads the live catalog and then fetches one question on demand", async () => {
    prepareSuccess();
    render(<App />);

    expect(screen.getByRole("heading", { name: /loading released SAT questions/i })).toBeVisible();
    expect(await screen.findByRole("heading", { name: /which choice best states/i })).toBeVisible();
    expect(qbankMocks.loadCatalog).toHaveBeenCalledTimes(1);
    expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2").closest("span")).toHaveTextContent(/2 eligible released questions live/i);
    expect(screen.getByRole("link", { name: /content from college board/i })).toBeVisible();
  });

  it("records one persistent miss without storing question content and auto-opens coaching", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });

    fireEvent.click(screen.getByRole("radio", { name: /the trends are unrelated/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/not quite/i);
    expect(screen.getByText(/accepted answer/i)).toHaveTextContent(/A/i);
    expect(screen.getByText(/the text links two elevation-specific trends/i)).toBeVisible();
    expect(await screen.findByText("AI summary")).toBeVisible();
    expect(coachMocks.requestCoachSummary).toHaveBeenCalledTimes(1);

    const raw = window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "";
    const saved = JSON.parse(raw) as { version?: number; attempts?: unknown[] };
    expect(saved.version).toBe(2);
    expect(saved.attempts).toHaveLength(1);
    expect(raw).not.toContain("Which choice");
    expect(raw).not.toContain("rationale");
  });

  it("supports skill filters and student-produced responses", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });

    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: "math" } });
    expect(await screen.findByRole("heading", { name: /what is the value of x/i })).toBeVisible();
    expect(screen.getByLabelText(/skill/i)).toHaveValue("All");
    expect(within(screen.getByLabelText(/skill/i)).getByRole("option", { name: "Linear equations" })).toBeVisible();

    fireEvent.change(screen.getByLabelText(/student-produced response/i), { target: { value: "4.0" } });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/correct/i);
    expect(screen.getByText(/accepted answer/i).closest("p")).toHaveTextContent(/4, 4.0/i);
    expect(coachMocks.requestCoachSummary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /explain this/i }));
    await waitFor(() => expect(coachMocks.requestCoachSummary).toHaveBeenCalledTimes(1));
  });

  it("hydrates progress only after the catalog is known", async () => {
    prepareSuccess();
    window.localStorage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        attempts: [
          {
            id: "saved-attempt",
            questionId: "rw-1",
            response: "A",
            correct: true,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );

    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });
    fireEvent.click(screen.getByRole("button", { name: /^memory$/i }));

    const row = screen.getByTestId("topic-Information and Ideas");
    expect(within(row).getByText(/1 attempt/i)).toBeVisible();
    expect(within(row).getByText(/100%/i)).toBeVisible();
  });

  it("keeps stale question details from replacing the current question", async () => {
    let resolveReading!: (question: QuestionDetail) => void;
    const delayedReading = new Promise<QuestionDetail>((resolve) => {
      resolveReading = resolve;
    });
    qbankMocks.loadCatalog.mockResolvedValue(catalog);
    qbankMocks.fetchQuestionDetail.mockImplementation((meta: QuestionMeta) =>
      meta.id === "rw-1" ? delayedReading : Promise.resolve(details[meta.id]),
    );

    render(<App />);
    await screen.findByText(/fetching this question/i);
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: "math" } });
    expect(await screen.findByRole("heading", { name: /what is the value of x/i })).toBeVisible();

    await act(async () => resolveReading(details["rw-1"]!));
    expect(screen.getByRole("heading", { name: /what is the value of x/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: /which choice best states/i })).not.toBeInTheDocument();
  });

  it("retries catalog and detail failures independently", async () => {
    qbankMocks.loadCatalog
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(catalog);
    qbankMocks.fetchQuestionDetail
      .mockRejectedValueOnce(new Error("detail failed"))
      .mockResolvedValueOnce(details["rw-1"]);

    render(<App />);
    expect(await screen.findByRole("heading", { name: /could not reach college board/i })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: /question did not arrive/i })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /retry question/i }));
    expect(await screen.findByRole("heading", { name: /which choice best states/i })).toBeVisible();
    expect(qbankMocks.loadCatalog).toHaveBeenCalledTimes(2);
    expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2);
  });

  it("offers a clear empty state when retry mode has no unresolved misses", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });
    fireEvent.click(screen.getByRole("button", { name: /practice misses/i }));

    expect(screen.getByRole("heading", { name: /retry queue is clear/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /practice all questions/i })).toBeVisible();
  });
});

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { PRACTICE_STORAGE_KEY } from "./lib/storage";
import type { QuestionDetail, QuestionMeta } from "./types";

const qbankMocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  fetchQuestionDetail: vi.fn(),
}));

vi.mock("./lib/qbank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/qbank")>();
  return {
    ...actual,
    loadCatalog: qbankMocks.loadCatalog,
    fetchQuestionDetail: qbankMocks.fetchQuestionDetail,
  };
});

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
};

describe("SAT practice app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    qbankMocks.loadCatalog.mockReset();
    qbankMocks.fetchQuestionDetail.mockReset();
  });

  it("loads the current question, prefetches one lookahead, and advances from memory", async () => {
    prepareSuccess();
    render(<App />);

    expect(screen.getByRole("heading", { name: /loading released SAT questions/i })).toBeVisible();
    expect(await screen.findByRole("heading", { name: /which choice best states/i })).toBeVisible();
    expect(qbankMocks.loadCatalog).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2),
    );
    expect(qbankMocks.fetchQuestionDetail).toHaveBeenNthCalledWith(
      2,
      catalog[1],
      expect.any(AbortSignal),
    );
    expect(screen.getByText("2").closest("span")).toHaveTextContent(/2 eligible released questions live/i);
    expect(screen.getByRole("link", { name: /content from college board/i })).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: /the trends are connected/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.getByRole("heading", { name: /what is the value of x/i })).toBeVisible();
    expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2);
  });

  it("starts the lookahead while the current question is still loading", async () => {
    let resolveCurrent!: (question: QuestionDetail) => void;
    const currentDetail = new Promise<QuestionDetail>((resolve) => {
      resolveCurrent = resolve;
    });
    qbankMocks.loadCatalog.mockResolvedValue(catalog);
    qbankMocks.fetchQuestionDetail.mockImplementation((meta: QuestionMeta) =>
      meta.id === "rw-1"
        ? currentDetail
        : Promise.resolve(details[meta.id]),
    );

    render(<App />);
    expect(await screen.findByText(/fetching this question/i)).toBeVisible();
    await waitFor(() =>
      expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2),
    );

    await act(async () => resolveCurrent(details["rw-1"]!));
    expect(
      await screen.findByRole("heading", { name: /which choice best states/i }),
    ).toBeVisible();
  });

  it("promotes a pending lookahead without restarting its request", async () => {
    let resolveLookahead!: (question: QuestionDetail) => void;
    const lookaheadDetail = new Promise<QuestionDetail>((resolve) => {
      resolveLookahead = resolve;
    });
    qbankMocks.loadCatalog.mockResolvedValue(catalog);
    qbankMocks.fetchQuestionDetail.mockImplementation((meta: QuestionMeta) =>
      meta.id === "rw-1"
        ? Promise.resolve(details[meta.id])
        : lookaheadDetail,
    );

    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });
    await waitFor(() =>
      expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2),
    );

    fireEvent.click(screen.getByRole("radio", { name: /the trends are connected/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /next question/i }));

    expect(screen.getByText(/fetching this question/i)).toBeVisible();
    expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2);
    await act(async () => resolveLookahead(details["math-1"]!));
    expect(
      await screen.findByRole("heading", { name: /what is the value of x/i }),
    ).toBeVisible();
    expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2);
  });

  it("cancels an irrelevant lookahead when the queue changes", async () => {
    qbankMocks.loadCatalog.mockResolvedValue(catalog);
    qbankMocks.fetchQuestionDetail.mockImplementation(
      (meta: QuestionMeta) =>
        meta.id === "rw-1"
          ? Promise.resolve(details[meta.id])
          : new Promise<QuestionDetail>(() => {}),
    );

    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });
    await waitFor(() =>
      expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2),
    );
    const prefetchSignal = qbankMocks.fetchQuestionDetail.mock.calls[1]?.[1] as
      | AbortSignal
      | undefined;
    expect(prefetchSignal?.aborted).toBe(false);

    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "reading-writing" },
    });

    await waitFor(() => expect(prefetchSignal?.aborted).toBe(true));
  });

  it("reattaches current detail loading after leaving and returning to Practice", async () => {
    let readingRequests = 0;
    qbankMocks.loadCatalog.mockResolvedValue(catalog);
    qbankMocks.fetchQuestionDetail.mockImplementation((meta: QuestionMeta) => {
      if (meta.id === "rw-1") {
        readingRequests += 1;
        return readingRequests === 1
          ? new Promise<QuestionDetail>(() => {})
          : Promise.resolve(details[meta.id]);
      }
      return Promise.resolve(details[meta.id]);
    });

    render(<App />);
    expect(await screen.findByText(/fetching this question/i)).toBeVisible();
    await waitFor(() =>
      expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(2),
    );

    fireEvent.click(screen.getByRole("button", { name: /^review$/i }));
    expect(
      screen.getByRole("heading", { name: /return to the ideas that slipped/i }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^practice$/i }));

    expect(
      await screen.findByRole("heading", { name: /which choice best states/i }),
    ).toBeVisible();
    expect(readingRequests).toBe(2);
    expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(3);
  });

  it("does not reopen an attempted question after a navigation round trip", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });

    fireEvent.click(screen.getByRole("radio", { name: /the trends are connected/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^review$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^practice$/i }));

    expect(
      await screen.findByRole("heading", { name: /what is the value of x/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /which choice best states/i }),
    ).not.toBeInTheDocument();
  });

  it("records one persistent miss without storing question content", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });

    fireEvent.click(screen.getByRole("radio", { name: /the trends are unrelated/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/not quite/i);
    expect(screen.getByText(/accepted answer/i)).toHaveTextContent(/A/i);
    expect(screen.getByText(/the text links two elevation-specific trends/i)).toBeVisible();

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
    await screen.findByRole("heading", { name: /what is the value of x/i });
    fireEvent.click(screen.getByRole("button", { name: /^memory$/i }));

    const row = screen.getByTestId("topic-Information and Ideas");
    expect(within(row).getByText(/1 attempt/i)).toBeVisible();
    expect(within(row).getByText(/100%/i)).toBeVisible();
  });

  it("keeps a second tab's attempts when this tab saves", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });

    // Another tab of the same browser records a math attempt after this tab loaded.
    window.localStorage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        attempts: [
          {
            id: "other-tab-attempt",
            questionId: "math-1",
            response: "4",
            correct: true,
            createdAt: "2026-08-03T12:00:00.000Z",
          },
        ],
      }),
    );

    fireEvent.click(screen.getByRole("radio", { name: /the trends are connected/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "{}",
      ) as { attempts: { id: string; questionId: string }[] };
      expect(saved.attempts.map((attempt) => attempt.questionId).sort()).toEqual([
        "math-1",
        "rw-1",
      ]);
    });
  });

  it("does not resurrect history erased by a reset in another tab", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });

    // Another tab resets, which bumps the generation this tab still believes in.
    window.localStorage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({ version: 2, generation: 1, attempts: [] }),
    );

    fireEvent.click(screen.getByRole("radio", { name: /the trends are connected/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "{}")).toEqual({
        version: 2,
        attempts: [],
        generation: 1,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^memory$/i }));
    expect(screen.getByText("total attempts").closest("span")).toHaveTextContent(
      /00total attempts/i,
    );
  });

  it("keeps progress intact when the browser refuses the reset write", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });
    fireEvent.click(screen.getByRole("radio", { name: /the trends are connected/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("storage is full");
      });
    fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset everything/i }));
    setItem.mockRestore();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nothing changed/i,
    );
    expect(screen.getByRole("alertdialog")).toBeVisible();
    const saved = JSON.parse(
      window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "{}",
    ) as { attempts?: unknown[] };
    expect(saved.attempts).toHaveLength(1);
  });

  it("commits a reset and bumps the stored generation", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });
    fireEvent.click(screen.getByRole("radio", { name: /the trends are connected/i }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset everything/i }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "{}")).toEqual({
      version: 2,
      attempts: [],
      generation: 1,
    });
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
    let readingAttempts = 0;
    qbankMocks.fetchQuestionDetail.mockImplementation((meta: QuestionMeta) => {
      if (meta.id === "rw-1") {
        readingAttempts += 1;
        return readingAttempts === 1
          ? Promise.reject(new Error("detail failed"))
          : Promise.resolve(details[meta.id]);
      }
      return Promise.resolve(details[meta.id]);
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: /could not reach college board/i })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: /question did not arrive/i })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /retry question/i }));
    expect(await screen.findByRole("heading", { name: /which choice best states/i })).toBeVisible();
    expect(qbankMocks.loadCatalog).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(qbankMocks.fetchQuestionDetail).toHaveBeenCalledTimes(3),
    );
  });

  it("offers a clear empty state when retry mode has no unresolved misses", async () => {
    prepareSuccess();
    render(<App />);
    await screen.findByRole("heading", { name: /which choice best states/i });
    fireEvent.click(screen.getByRole("button", { name: /practice misses/i }));

    expect(screen.getByRole("heading", { name: /retry queue is clear/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /practice new questions/i })).toBeVisible();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PracticeView } from "./PracticeView";
import type { QuestionDetail } from "../types";

const question: QuestionDetail = {
  id: "q1",
  section: "math",
  domainCode: "H",
  domain: "Algebra",
  skillCode: "H.C.",
  skill: "Linear equations",
  difficulty: "medium",
  kind: "multiple-choice",
  stimulusHtml: "",
  promptHtml: "<p>What is 2 + 2?</p>",
  choices: [
    { id: "a", label: "A", html: "<p>3</p>" },
    { id: "b", label: "B", html: "<p>4</p>" },
  ],
  correctAnswers: ["B"],
  rationaleHtml: "<p>Because it is.</p>",
};

const renderView = (overrides: Partial<Parameters<typeof PracticeView>[0]> = {}) => {
  const onSubmit = vi.fn(() => true);
  const onNext = vi.fn();
  render(
    <PracticeView
      currentMeta={question}
      detailState={{ status: "ready", questionId: question.id, question }}
      pool={[question]}
      stats={[]}
      unresolvedCount={0}
      attemptedCount={0}
      queueMode="all"
      focusQuestion={false}
      pastAttempt={null}
      canGoBack={false}
      onBack={vi.fn()}
      initialResponse=""
      initialElapsedMs={0}
      onDraftChange={vi.fn()}
      onSubmit={onSubmit}
      onNext={onNext}
      onRetryDetail={vi.fn()}
      onPracticeAll={vi.fn()}
      {...overrides}
    />,
  );
  return { onSubmit, onNext };
};

const pressEnter = (target: Element = document.body) => {
  fireEvent.keyDown(target, { key: "Enter", bubbles: true });
};

describe("PracticeView keyboard flow", () => {
  afterEach(() => vi.useRealTimers());

  it("lets students type a square-root answer", () => {
    const rootQuestion: QuestionDetail = {
      ...question,
      kind: "student-produced-response",
      choices: [],
      correctAnswers: ["2"],
    };
    const { onSubmit } = renderView({
      currentMeta: rootQuestion,
      detailState: { status: "ready", questionId: rootQuestion.id, question: rootQuestion },
      pool: [rootQuestion],
    });

    const answer = screen.getByRole("textbox", { name: "Student-produced response" });
    expect(answer).toHaveAttribute("inputmode", "text");
    fireEvent.change(answer, { target: { value: "sqrt(4)" } });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(onSubmit).toHaveBeenCalledWith("sqrt(4)", expect.any(Number));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
  });

  it("times the current question and stops when the answer is checked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
    const { onSubmit } = renderView();

    expect(screen.getByText("00:00")).toBeVisible();
    act(() => vi.advanceTimersByTime(65_000));
    expect(screen.getByText("01:05")).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: /4/ }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(onSubmit).toHaveBeenCalledWith("B", 65_000);

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("01:05")).toBeVisible();
  });

  it("resumes an unfinished question timer after visiting history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
    const onBack = vi.fn();
    const { onSubmit } = renderView({ initialElapsedMs: 30_000, canGoBack: true, onBack });

    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByText("00:42")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledWith(42_000);

    fireEvent.click(screen.getByRole("radio", { name: /4/ }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(onSubmit).toHaveBeenCalledWith("B", 42_000);
  });

  it("checks on Enter, then advances on the next Enter", () => {
    const { onSubmit, onNext } = renderView();

    // Nothing selected yet: Enter must not submit an empty response.
    pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /4/ }));
    pressEnter();
    expect(onSubmit).toHaveBeenCalledWith("B", expect.any(Number));
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();

    pressEnter();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter alone inside the calculator panel", () => {
    const { onSubmit } = renderView();
    fireEvent.click(screen.getByRole("radio", { name: /4/ }));
    fireEvent.click(screen.getByRole("button", { name: /graphing calculator/i }));

    const panel = document.querySelector(".calculator-panel");
    expect(panel).not.toBeNull();
    pressEnter(panel as Element);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the calculator on reading and writing questions", () => {
    const reading = { ...question, section: "reading-writing" as const };
    renderView({
      currentMeta: reading,
      detailState: { status: "ready", questionId: reading.id, question: reading },
      pool: [reading],
    });

    expect(
      screen.queryByRole("button", { name: /graphing calculator/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a past attempt read-only and can hide all answer cues", () => {
    const { onSubmit, onNext } = renderView({
      pastAttempt: {
        id: "past-1", questionId: "q1", response: "A", correct: false,
        createdAt: "2026-09-26T12:00:00.000Z", durationMs: 12_000,
      },
    });

    expect(screen.getByRole("radio", { name: /3/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /3/ })).toBeDisabled();
    expect(screen.getByText("Correct answer")).toBeVisible();
    expect(screen.getByText("Your answer")).toBeVisible();
    expect(screen.getByText("00:12")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /hide answers/i }));
    expect(screen.getByRole("radio", { name: /3/ })).not.toBeChecked();
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByText("Your answer")).not.toBeInTheDocument();
    expect(screen.queryByText(/because it is/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/accepted answer/i)).not.toBeInTheDocument();
    expect(document.querySelector(".answer-option.is-correct, .answer-option.is-incorrect")).toBeNull();
    pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /show answers/i }));
    expect(screen.getByRole("radio", { name: /3/ })).toBeChecked();
    expect(screen.getByText("Correct answer")).toBeVisible();
  });
});

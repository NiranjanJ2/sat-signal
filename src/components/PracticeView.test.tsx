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
});

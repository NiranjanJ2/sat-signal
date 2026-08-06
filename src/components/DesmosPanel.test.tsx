import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const desmosScripts = () =>
  Array.from(document.querySelectorAll("script")).filter((script) =>
    script.src.includes("desmos.com"),
  );

const settleScript = async (outcome: "load" | "error") => {
  const script = desmosScripts().at(-1);
  expect(script).toBeDefined();
  await act(async () => {
    script?.dispatchEvent(new Event(outcome));
  });
};

const freshModule = () => import("./DesmosPanel");

const calculator = {
  destroy: vi.fn(),
  setState: vi.fn(),
  getState: () => ({ graph: "saved" }),
};
const create = vi.fn(() => calculator);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const script of desmosScripts()) {
    script.remove();
  }
  window.Desmos = { GraphingCalculator: create };
});

describe("DesmosPanel", () => {
  it("loads the script once and carries the graph to the next question", async () => {
    const { DesmosPanel } = await freshModule();
    const first = render(<DesmosPanel onClose={vi.fn()} />);

    expect(desmosScripts()).toHaveLength(1);
    await settleScript("load");
    expect(create).toHaveBeenCalledTimes(1);
    expect(calculator.setState).not.toHaveBeenCalled();

    // Advancing the queue remounts PracticeView, which remounts this panel.
    first.unmount();
    expect(calculator.destroy).toHaveBeenCalledTimes(1);

    render(<DesmosPanel onClose={vi.fn()} />);
    expect(desmosScripts()).toHaveLength(1);
    await act(async () => {});
    expect(create).toHaveBeenCalledTimes(2);
    expect(calculator.setState).toHaveBeenCalledWith({ graph: "saved" });
  });

  it("reports a failed load instead of leaving a blank panel", async () => {
    const { DesmosPanel } = await freshModule();
    const onClose = vi.fn();
    render(<DesmosPanel onClose={onClose} />);

    await settleScript("error");

    expect(screen.getByRole("alert")).toHaveTextContent("Desmos did not load.");
    expect(create).not.toHaveBeenCalled();

    screen.getByRole("button", { name: /close and retry/i }).click();
    expect(onClose).toHaveBeenCalled();
  });

  it("remembers the open flag across question remounts", async () => {
    const { isCalculatorOpen, rememberCalculatorOpen } = await freshModule();

    expect(isCalculatorOpen()).toBe(false);
    rememberCalculatorOpen(true);
    expect(isCalculatorOpen()).toBe(true);
  });
});

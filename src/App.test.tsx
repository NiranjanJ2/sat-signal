import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { PRACTICE_STORAGE_KEY } from "./lib/storage";

describe("SAT practice app", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens on a question and waits for an answer before enabling submission", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /which choice best states/i })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /check answer/i })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect(screen.getByRole("button", { name: /check answer/i })).toBeEnabled();
  });

  it("records one persistent miss, locks choices, and reveals coaching", async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole("radio")[1]);
    const submit = screen.getByRole("button", { name: /check answer/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByRole("status")).toHaveTextContent(/not quite/i);
    expect(screen.getAllByRole("radio")[0]).toBeDisabled();
    expect(screen.getByText(/the text links two elevation-specific trends/i)).toBeVisible();
    expect(screen.getByText(/1 unresolved/i)).toBeVisible();

    const saved = JSON.parse(
      window.localStorage.getItem(PRACTICE_STORAGE_KEY) ?? "{}",
    ) as { attempts?: unknown[]; unresolvedIds?: string[] };
    expect(saved.attempts).toHaveLength(1);
    expect(saved.unresolvedIds).toEqual(["rw-central-idea-001"]);
  });

  it("filters the active pool with intersection semantics", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "math" },
    });
    fireEvent.change(screen.getByLabelText(/difficulty/i), {
      target: { value: "hard" },
    });

    expect(screen.getByText(/math · hard/i)).toBeVisible();
    expect(screen.getByText(/of 4/i)).toBeVisible();
  });

  it("shows persisted progress in the memory view after remount", () => {
    const first = render(<App />);

    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    first.unmount();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^memory$/i }));

    const informationRow = screen.getByTestId("topic-Information and Ideas");
    expect(within(informationRow).getByText(/1 attempt/i)).toBeVisible();
    expect(within(informationRow).getByText(/100%/i)).toBeVisible();
  });

  it("offers a clear empty state when retry mode has no unresolved misses", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /practice misses/i }));

    expect(screen.getByRole("heading", { name: /retry queue is clear/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /practice all questions/i })).toBeVisible();
  });
});


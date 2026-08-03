import type { Attempt, PracticeState } from "../types";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ProgressLoadResult =
  | { available: false }
  | { available: true; document: unknown };

export type ProgressImportResult = "saved" | "stale" | "unavailable";

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

export function progressGeneration(document: unknown): number | null {
  if (
    typeof document !== "object" ||
    document === null ||
    !("version" in document) ||
    document.version !== 2 ||
    !("generation" in document) ||
    typeof document.generation !== "number" ||
    !Number.isInteger(document.generation) ||
    document.generation < 0 ||
    !("attempts" in document) ||
    !Array.isArray(document.attempts)
  ) {
    return null;
  }

  return document.generation;
}

export async function loadProgressDocument(
  signal: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<ProgressLoadResult> {
  try {
    const response = await fetchImpl("/api/progress", { signal });
    if (!response.ok) {
      return { available: false };
    }

    const document: unknown = await response.json();
    return progressGeneration(document) === null
      ? { available: false }
      : { available: true, document };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      throw error;
    }
    return { available: false };
  }
}

export async function importProgressDocument(
  state: PracticeState,
  generation: number,
  fetchImpl: FetchLike = fetch,
): Promise<ProgressImportResult> {
  try {
    const response = await fetchImpl("/api/progress/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 2, generation, attempts: state.attempts }),
    });
    if (response.status === 409) {
      return "stale";
    }
    return response.ok ? "saved" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function appendProgressAttempt(
  attempt: Attempt,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl("/api/progress/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function resetProgressDocument(
  fetchImpl: FetchLike = fetch,
): Promise<ProgressLoadResult> {
  try {
    const response = await fetchImpl("/api/progress", { method: "DELETE" });
    if (!response.ok) {
      return { available: false };
    }

    const document: unknown = await response.json();
    return progressGeneration(document) === null
      ? { available: false }
      : { available: true, document };
  } catch {
    return { available: false };
  }
}

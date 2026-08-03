import type { Attempt, PracticeState } from "../types";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ProgressLoadResult =
  | { available: false }
  | { available: true; document: unknown };

export type ProgressMutationResult =
  | { status: "saved" }
  | { status: "stale"; document: unknown }
  | { status: "unavailable" };

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
): Promise<ProgressMutationResult> {
  try {
    const response = await fetchImpl("/api/progress/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 2, generation, attempts: state.attempts }),
    });
    if (response.status === 409) {
      return parseConflict(response);
    }
    return response.ok ? { status: "saved" } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function appendProgressAttempt(
  attempt: Attempt,
  generation: number,
  fetchImpl: FetchLike = fetch,
): Promise<ProgressMutationResult> {
  try {
    const response = await fetchImpl("/api/progress/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation, attempt }),
    });
    if (response.status === 409) {
      return parseConflict(response);
    }
    return response.ok ? { status: "saved" } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
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

async function parseConflict(response: Response): Promise<ProgressMutationResult> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "current" in payload &&
      progressGeneration(payload.current) !== null
    ) {
      return { status: "stale", document: payload.current };
    }
  } catch {
    // A malformed conflict response is treated as an unavailable store.
  }
  return { status: "unavailable" };
}

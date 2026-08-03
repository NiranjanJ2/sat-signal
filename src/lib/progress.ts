import type { PracticeState } from "../types";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ProgressLoadResult =
  | { available: false }
  | { available: true; document: unknown };

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

export async function loadProgressDocument(
  signal: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<ProgressLoadResult> {
  try {
    const response = await fetchImpl("/api/progress", { signal });
    if (!response.ok) {
      return { available: false };
    }

    return { available: true, document: await response.json() };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      throw error;
    }
    return { available: false };
  }
}

export async function saveProgressDocument(
  state: PracticeState,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 2, attempts: state.attempts }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

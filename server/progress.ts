import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Attempt } from "../src/types";

export type ProgressDocument = {
  version: 2;
  generation: number;
  attempts: Attempt[];
};

export const DEFAULT_PROGRESS_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".sat-signal",
  "progress.json",
);

export class InvalidProgressDocumentError extends Error {
  constructor(
    message: string,
    readonly source: "input" | "disk",
  ) {
    super(message);
    this.name = "InvalidProgressDocumentError";
  }
}

export class ProgressGenerationConflictError extends Error {
  constructor(readonly current: ProgressDocument) {
    super("Progress generation is stale.");
    this.name = "ProgressGenerationConflictError";
  }
}

export class ProgressStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(readonly filePath = DEFAULT_PROGRESS_FILE) {}

  read(): Promise<ProgressDocument> {
    return this.enqueue(() => this.readFromDisk());
  }

  import(value: unknown): Promise<ProgressDocument> {
    let imported: ProgressDocument;
    try {
      imported = normalizeImportDocument(value);
    } catch (error) {
      return Promise.reject(error);
    }

    return this.enqueue(async () => {
      const current = await this.readFromDisk();
      if (imported.generation !== current.generation) {
        throw new ProgressGenerationConflictError(current);
      }

      const merged = {
        ...current,
        attempts: unionAttempts(current.attempts, imported.attempts),
      };
      if (merged.attempts.length !== current.attempts.length) {
        await this.writeToDisk(merged);
      }
      return merged;
    });
  }

  append(value: unknown): Promise<ProgressDocument> {
    let appendRequest: { generation: number; attempt: Attempt };
    try {
      appendRequest = normalizeAppendRequest(value);
    } catch (error) {
      return Promise.reject(error);
    }

    return this.enqueue(async () => {
      const current = await this.readFromDisk();
      if (appendRequest.generation !== current.generation) {
        throw new ProgressGenerationConflictError(current);
      }
      if (current.attempts.some(({ id }) => id === appendRequest.attempt.id)) {
        return current;
      }

      const updated = {
        ...current,
        attempts: [...current.attempts, appendRequest.attempt],
      };
      await this.writeToDisk(updated);
      return updated;
    });
  }

  reset(): Promise<ProgressDocument> {
    return this.enqueue(async () => {
      const current = await this.readFromDisk();
      const reset = {
        version: 2 as const,
        generation: current.generation + 1,
        attempts: [],
      };
      await this.writeToDisk(reset);
      return reset;
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readFromDisk(): Promise<ProgressDocument> {
    let contents: string;
    try {
      contents = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: 2, generation: 0, attempts: [] };
      }
      throw error;
    }

    try {
      return normalizeDiskDocument(JSON.parse(contents));
    } catch (error) {
      if (error instanceof InvalidProgressDocumentError) {
        throw error;
      }
      throw new InvalidProgressDocumentError(
        "Stored progress is not valid JSON.",
        "disk",
      );
    }
  }

  private async writeToDisk(document: ProgressDocument): Promise<void> {
    const directory = path.dirname(this.filePath);
    const temporaryFile = path.join(
      directory,
      `.${path.basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );

    await mkdir(directory, { recursive: true });
    try {
      await writeFile(temporaryFile, JSON.stringify(document), {
        encoding: "utf8",
        flag: "wx",
        flush: true,
      });
      await rename(temporaryFile, this.filePath);
    } catch (error) {
      await unlink(temporaryFile).catch(() => undefined);
      throw error;
    }
  }
}

function normalizeAppendRequest(value: unknown): {
  generation: number;
  attempt: Attempt;
} {
  if (!isRecord(value) || !isGeneration(value.generation)) {
    throw new InvalidProgressDocumentError(
      "Progress append must include a generation and attempt.",
      "input",
    );
  }

  return {
    generation: value.generation,
    attempt: normalizeAttempt(value.attempt, "input"),
  };
}

function normalizeImportDocument(value: unknown): ProgressDocument {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !isGeneration(value.generation) ||
    !Array.isArray(value.attempts)
  ) {
    throw new InvalidProgressDocumentError(
      "Progress import must include version, generation, and attempts.",
      "input",
    );
  }

  return {
    version: 2,
    generation: value.generation,
    attempts: uniqueAttempts(
      value.attempts.map((attempt) => normalizeAttempt(attempt, "input")),
    ),
  };
}

function normalizeDiskDocument(value: unknown): ProgressDocument {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !Array.isArray(value.attempts) ||
    (value.generation !== undefined && !isGeneration(value.generation))
  ) {
    throw new InvalidProgressDocumentError(
      "Stored progress has an invalid shape.",
      "disk",
    );
  }

  return {
    version: 2,
    generation: value.generation ?? 0,
    attempts: uniqueAttempts(
      value.attempts.map((attempt) => normalizeAttempt(attempt, "disk")),
    ),
  };
}

function normalizeAttempt(value: unknown, source: "input" | "disk"): Attempt {
  if (
    !isRecord(value) ||
    !isNonemptyString(value.id) ||
    !isNonemptyString(value.questionId) ||
    !isNonemptyString(value.response) ||
    typeof value.correct !== "boolean" ||
    !isNonemptyString(value.createdAt) ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    throw new InvalidProgressDocumentError(
      "Progress contains an invalid attempt.",
      source,
    );
  }

  return {
    id: value.id,
    questionId: value.questionId,
    response: value.response,
    correct: value.correct,
    createdAt: value.createdAt,
  };
}

function unionAttempts(
  current: readonly Attempt[],
  imported: readonly Attempt[],
): Attempt[] {
  return uniqueAttempts([...current, ...imported]);
}

function uniqueAttempts(attempts: readonly Attempt[]): Attempt[] {
  const ids = new Set<string>();
  return attempts.filter(({ id }) => {
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
}

function isGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

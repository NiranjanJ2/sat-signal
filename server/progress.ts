import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Attempt } from "../src/types";

export type ProgressDocument = {
  version: 2;
  attempts: Attempt[];
};

export const DEFAULT_PROGRESS_FILE = path.resolve(
  process.cwd(),
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

export class ProgressStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(readonly filePath = DEFAULT_PROGRESS_FILE) {}

  read(): Promise<ProgressDocument> {
    return this.enqueue(() => this.readFromDisk());
  }

  write(value: unknown): Promise<void> {
    let document: ProgressDocument;
    try {
      document = normalizeProgressDocument(value);
    } catch (error) {
      return Promise.reject(error);
    }

    return this.enqueue(async () => {
      // Refuse to replace an unreadable file. This preserves the evidence needed
      // to recover it instead of silently resetting a student's history.
      await this.readFromDisk();

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
        });
        await rename(temporaryFile, this.filePath);
      } catch (error) {
        await unlink(temporaryFile).catch(() => undefined);
        throw error;
      }
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
        return { version: 2, attempts: [] };
      }
      throw error;
    }

    try {
      return normalizeProgressDocument(JSON.parse(contents), "disk");
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
}

function normalizeProgressDocument(
  value: unknown,
  source: "input" | "disk" = "input",
): ProgressDocument {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.attempts)) {
    throw new InvalidProgressDocumentError(
      "Progress must be a version 2 document containing attempts.",
      source,
    );
  }

  const attempts = value.attempts.map((attempt) => normalizeAttempt(attempt, source));
  return { version: 2, attempts };
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

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

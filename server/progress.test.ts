import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  InvalidProgressDocumentError,
  ProgressStore,
} from "./progress";

const emptyDocument = { version: 2 as const, attempts: [] };
const attempt = {
  id: "attempt-1",
  questionId: "question-1",
  response: "B",
  correct: false,
  createdAt: "2026-08-03T12:00:00.000Z",
};

describe("ProgressStore", () => {
  const temporaryDirectories: string[] = [];

  const makeProgressFile = async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "sat-progress-test-"));
    temporaryDirectories.push(directory);
    return path.join(directory, ".sat-signal", "progress.json");
  };

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it("returns an empty version 2 document when the file is missing", async () => {
    const store = new ProgressStore(await makeProgressFile());

    await expect(store.read()).resolves.toEqual(emptyDocument);
  });

  it("atomically persists only version and validated attempts", async () => {
    const progressFile = await makeProgressFile();
    const store = new ProgressStore(progressFile);

    await store.write({
      version: 2,
      attempts: [{ ...attempt, extra: "question content must not persist" }],
      extra: "discard me",
    });

    expect(JSON.parse(await readFile(progressFile, "utf8"))).toEqual({
      version: 2,
      attempts: [attempt],
    });
    expect(await readFile(progressFile, "utf8")).not.toContain("question content");
    expect(await readFile(progressFile, "utf8")).not.toContain("discard me");
  });

  it.each([
    { version: 1, attempts: [] },
    { version: 2 },
    { version: 2, attempts: [{ ...attempt, response: "" }] },
    { version: 2, attempts: [{ ...attempt, correct: "false" }] },
    { version: 2, attempts: [{ ...attempt, createdAt: "not-a-date" }] },
  ])("rejects a malformed document without writing it: %j", async (document) => {
    const progressFile = await makeProgressFile();
    const store = new ProgressStore(progressFile);

    await expect(store.write(document)).rejects.toBeInstanceOf(
      InvalidProgressDocumentError,
    );
    await expect(readFile(progressFile, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reports malformed disk JSON and refuses to overwrite it", async () => {
    const progressFile = await makeProgressFile();
    await mkdir(path.dirname(progressFile), { recursive: true });
    await writeFile(progressFile, "{broken", "utf8");
    const store = new ProgressStore(progressFile);

    await expect(store.read()).rejects.toBeInstanceOf(
      InvalidProgressDocumentError,
    );
    await expect(store.write(emptyDocument)).rejects.toBeInstanceOf(
      InvalidProgressDocumentError,
    );
    await expect(readFile(progressFile, "utf8")).resolves.toBe("{broken");
  });

  it("serializes writes and makes an immediate read wait for the latest write", async () => {
    const progressFile = await makeProgressFile();
    const store = new ProgressStore(progressFile);
    const secondAttempt = {
      ...attempt,
      id: "attempt-2",
      questionId: "question-2",
      correct: true,
    };

    const firstWrite = store.write({ version: 2, attempts: [attempt] });
    const secondWrite = store.write({ version: 2, attempts: [attempt, secondAttempt] });
    const readAfterWrites = store.read();

    await expect(Promise.all([firstWrite, secondWrite, readAfterWrites])).resolves.toEqual([
      undefined,
      undefined,
      { version: 2, attempts: [attempt, secondAttempt] },
    ]);
  });
});

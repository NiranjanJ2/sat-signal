import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  InvalidProgressDocumentError,
  ProgressGenerationConflictError,
  ProgressStore,
} from "./progress";

const emptyDocument = { version: 2 as const, generation: 0, attempts: [] };
const attempt = {
  id: "attempt-1",
  questionId: "question-1",
  response: "B",
  correct: false,
  createdAt: "2026-08-03T12:00:00.000Z",
};
const secondAttempt = {
  ...attempt,
  id: "attempt-2",
  questionId: "question-2",
  response: "C",
  correct: true,
};
const execFileAsync = promisify(execFile);

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

  it("returns generation zero with no attempts when the file is missing", async () => {
    const store = new ProgressStore(await makeProgressFile());

    await expect(store.read()).resolves.toEqual(emptyDocument);
  });

  it("anchors the default progress file to the app root, not launch cwd", async () => {
    const alternateCwd = await mkdtemp(path.join(tmpdir(), "sat-launch-cwd-"));
    temporaryDirectories.push(alternateCwd);
    const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
    const moduleUrl = pathToFileURL(path.join(serverDirectory, "progress.ts")).href;
    const tsxLoader = path.resolve(
      serverDirectory,
      "..",
      "node_modules/tsx/dist/loader.mjs",
    );

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--import",
        tsxLoader,
        "--input-type=module",
        "--eval",
        `console.log((await import(${JSON.stringify(moduleUrl)})).DEFAULT_PROGRESS_FILE)`,
      ],
      { cwd: alternateCwd },
    );

    expect(stdout.trim()).toBe(
      path.resolve(serverDirectory, "..", ".sat-signal", "progress.json"),
    );
  });

  it("loads a version 2 disk document without generation as generation zero", async () => {
    const progressFile = await makeProgressFile();
    await mkdir(path.dirname(progressFile), { recursive: true });
    await writeFile(
      progressFile,
      JSON.stringify({ version: 2, attempts: [attempt] }),
      "utf8",
    );

    await expect(new ProgressStore(progressFile).read()).resolves.toEqual({
      version: 2,
      generation: 0,
      attempts: [attempt],
    });
  });

  it("imports a sanitized union of unique attempts in the current generation", async () => {
    const progressFile = await makeProgressFile();
    const store = new ProgressStore(progressFile);
    await store.append({ generation: 0, attempt });

    await expect(
      store.import({
        version: 2,
        generation: 0,
        attempts: [
          { ...attempt, response: "conflicting duplicate stays ignored" },
          { ...secondAttempt, extra: "question content must not persist" },
          secondAttempt,
        ],
        extra: "discard me",
      }),
    ).resolves.toEqual({
      version: 2,
      generation: 0,
      attempts: [attempt, secondAttempt],
    });

    const stored = await readFile(progressFile, "utf8");
    expect(JSON.parse(stored)).toEqual({
      version: 2,
      generation: 0,
      attempts: [attempt, secondAttempt],
    });
    expect(stored).not.toContain("question content");
    expect(stored).not.toContain("discard me");
  });

  it("serializes concurrent imports so neither valid attempt is dropped", async () => {
    const store = new ProgressStore(await makeProgressFile());

    const firstImport = store.import({
      version: 2,
      generation: 0,
      attempts: [attempt],
    });
    const secondImport = store.import({
      version: 2,
      generation: 0,
      attempts: [secondAttempt],
    });
    const readAfterImports = store.read();

    await expect(Promise.all([firstImport, secondImport, readAfterImports])).resolves.toEqual([
      { version: 2, generation: 0, attempts: [attempt] },
      { version: 2, generation: 0, attempts: [attempt, secondAttempt] },
      { version: 2, generation: 0, attempts: [attempt, secondAttempt] },
    ]);
  });

  it("rejects a stale import after reset without restoring erased history", async () => {
    const progressFile = await makeProgressFile();
    const store = new ProgressStore(progressFile);
    await store.append({ generation: 0, attempt });
    await expect(store.reset()).resolves.toEqual({
      version: 2,
      generation: 1,
      attempts: [],
    });
    await store.append({ generation: 1, attempt: secondAttempt });

    await expect(
      store.import({ version: 2, generation: 0, attempts: [attempt] }),
    ).rejects.toBeInstanceOf(ProgressGenerationConflictError);
    await expect(store.read()).resolves.toEqual({
      version: 2,
      generation: 1,
      attempts: [secondAttempt],
    });
  });

  it("appends only a new attempt after reset and retains it across store restart", async () => {
    const progressFile = await makeProgressFile();
    const store = new ProgressStore(progressFile);
    await store.append({ generation: 0, attempt });
    await store.reset();

    await expect(
      store.append({ generation: 1, attempt: secondAttempt }),
    ).resolves.toEqual({
      version: 2,
      generation: 1,
      attempts: [secondAttempt],
    });
    await expect(new ProgressStore(progressFile).read()).resolves.toEqual({
      version: 2,
      generation: 1,
      attempts: [secondAttempt],
    });
  });

  it("rejects a stale append racing after reset, then accepts the current generation", async () => {
    const store = new ProgressStore(await makeProgressFile());
    await store.reset();

    await expect(
      store.append({ generation: 0, attempt }),
    ).rejects.toBeInstanceOf(ProgressGenerationConflictError);
    await expect(store.read()).resolves.toEqual({
      version: 2,
      generation: 1,
      attempts: [],
    });
    await expect(
      store.append({ generation: 1, attempt: secondAttempt }),
    ).resolves.toEqual({
      version: 2,
      generation: 1,
      attempts: [secondAttempt],
    });
  });

  it.each([
    { kind: "import", value: { version: 1, generation: 0, attempts: [] } },
    { kind: "import", value: { version: 2, generation: -1, attempts: [] } },
    { kind: "import", value: { version: 2, generation: 0 } },
    {
      kind: "import",
      value: { version: 2, generation: 0, attempts: [{ ...attempt, response: "" }] },
    },
    { kind: "append", value: { generation: -1, attempt } },
    {
      kind: "append",
      value: { generation: 0, attempt: { ...attempt, correct: "false" } },
    },
    {
      kind: "append",
      value: { generation: 0, attempt: { ...attempt, createdAt: "not-a-date" } },
    },
  ])("rejects malformed $kind input without writing it", async ({ kind, value }) => {
    const progressFile = await makeProgressFile();
    const store = new ProgressStore(progressFile);

    const operation = kind === "import" ? store.import(value) : store.append(value);
    await expect(operation).rejects.toBeInstanceOf(InvalidProgressDocumentError);
    await expect(readFile(progressFile, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reports malformed disk JSON and refuses every mutation without overwriting it", async () => {
    const progressFile = await makeProgressFile();
    await mkdir(path.dirname(progressFile), { recursive: true });
    await writeFile(progressFile, "{broken", "utf8");
    const store = new ProgressStore(progressFile);

    await expect(store.read()).rejects.toBeInstanceOf(InvalidProgressDocumentError);
    await expect(store.append({ generation: 0, attempt })).rejects.toBeInstanceOf(
      InvalidProgressDocumentError,
    );
    await expect(
      store.import({ version: 2, generation: 0, attempts: [attempt] }),
    ).rejects.toBeInstanceOf(InvalidProgressDocumentError);
    await expect(store.reset()).rejects.toBeInstanceOf(
      InvalidProgressDocumentError,
    );
    await expect(readFile(progressFile, "utf8")).resolves.toBe("{broken");
  });
});

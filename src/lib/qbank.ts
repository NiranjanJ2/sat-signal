import type {
  Difficulty,
  QuestionChoice,
  QuestionDetail,
  QuestionMeta,
  Subject,
} from "../types";

const API_BASE =
  "https://qbank-api.collegeboard.org/msreportingquestionbank-prod";
const LEGACY_BASE = "https://saic.collegeboard.org/disclosed";

export type QBankErrorCode = "network" | "http" | "invalid-response";

export class QBankError extends Error {
  override readonly name = "QBankError";

  constructor(
    readonly code: QBankErrorCode,
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

type FetchImpl = typeof fetch;
type UnknownRecord = Record<string, unknown>;

export async function loadCatalog(
  signal: AbortSignal,
  fetchImpl: FetchImpl = globalThis.fetch,
): Promise<QuestionMeta[]> {
  const [lookupValue, readingValue, mathValue] = await Promise.all([
    requestJson(
      `${API_BASE}/questionbank/lookup`,
      { method: "GET", signal },
      fetchImpl,
    ),
    requestJson(
      `${API_BASE}/questionbank/digital/get-questions`,
      listRequest(1, "INI,CAS,EOI,SEC", signal),
      fetchImpl,
    ),
    requestJson(
      `${API_BASE}/questionbank/digital/get-questions`,
      listRequest(2, "H,P,Q,S", signal),
      fetchImpl,
    ),
  ]);

  const lookup = parseLookup(lookupValue);
  const reading = parseMetadataList(
    readingValue,
    "reading-writing",
    lookup.reading,
  );
  const math = parseMetadataList(mathValue, "math", lookup.math);

  return [...reading, ...math].sort(compareNormalizedIds);
}

export async function fetchQuestionDetail(
  meta: QuestionMeta,
  signal: AbortSignal,
  fetchImpl: FetchImpl = globalThis.fetch,
): Promise<QuestionDetail> {
  if (meta.externalId) {
    const value = await requestJson(
      `${API_BASE}/questionbank/digital/get-question`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ external_id: meta.externalId }),
        signal,
      },
      fetchImpl,
    );

    return parseStandardDetail(meta, value);
  }

  if (meta.ibn) {
    const value = await requestJson(
      `${LEGACY_BASE}/${encodeURIComponent(meta.ibn)}.json`,
      { method: "GET", signal },
      fetchImpl,
    );

    return parseLegacyDetail(meta, value);
  }

  throw invalidResponse(`Question ${meta.id} has no fetchable identifier`);
}

export function gradeResponse(
  detail: QuestionDetail,
  response: string,
): boolean {
  const normalized = normalizeResponse(response);
  if (!normalized) {
    return false;
  }

  if (detail.kind === "multiple-choice") {
    const choice = detail.choices.find(
      ({ id, label }) =>
        normalizeResponse(id) === normalized ||
        normalizeResponse(label) === normalized,
    );
    const submittedLabel = normalizeResponse(choice?.label ?? normalized);

    return detail.correctAnswers.some(
      (answer) => normalizeResponse(answer) === submittedLabel,
    );
  }

  const numericResponse = parseFiniteNumber(normalized);

  return detail.correctAnswers.some((answer) => {
    const normalizedAnswer = normalizeResponse(answer);
    if (normalizedAnswer === normalized) {
      return true;
    }

    const numericAnswer = parseFiniteNumber(normalizedAnswer);
    return (
      numericResponse !== null &&
      numericAnswer !== null &&
      numericResponse === numericAnswer
    );
  });
}

function listRequest(
  test: 1 | 2,
  domain: string,
  signal: AbortSignal,
): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asmtEventId: 99, test, domain }),
    signal,
  };
}

async function requestJson(
  input: string,
  init: RequestInit,
  fetchImpl: FetchImpl,
): Promise<unknown> {
  let serviceResponse: Response;

  try {
    serviceResponse = await fetchImpl(input, init);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new QBankError("network", "Question bank request failed", undefined, {
      cause: error,
    });
  }

  if (!serviceResponse.ok) {
    throw new QBankError(
      "http",
      `Question bank returned HTTP ${serviceResponse.status}`,
      serviceResponse.status,
    );
  }

  try {
    return await serviceResponse.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw invalidResponse("Question bank returned invalid JSON", error);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function parseLookup(value: unknown): {
  reading: ReadonlySet<string>;
  math: ReadonlySet<string>;
} {
  const record = requireRecord(value, "lookup");
  return {
    reading: new Set(
      requireStringArray(record.readingLiveItems, "lookup.readingLiveItems").map(
        normalizedId,
      ),
    ),
    math: new Set(
      requireStringArray(record.mathLiveItems, "lookup.mathLiveItems").map(
        normalizedId,
      ),
    ),
  };
}

function parseMetadataList(
  value: unknown,
  section: Subject,
  liveIds: ReadonlySet<string>,
): QuestionMeta[] {
  if (!Array.isArray(value)) {
    throw invalidResponse(`${section} metadata must be an array`);
  }

  const result: QuestionMeta[] = [];
  value.forEach((item, index) => {
    const record = requireRecord(item, `${section} metadata[${index}]`);
    requireNonemptyString(record.questionId, `metadata[${index}].questionId`);

    const externalId = optionalTrimmedString(
      record.external_id,
      `metadata[${index}].external_id`,
    );
    const ibn = optionalTrimmedString(
      record.ibn,
      `metadata[${index}].ibn`,
    );

    if (!externalId && !ibn) {
      return;
    }

    if (externalId && liveIds.has(normalizedId(externalId))) {
      return;
    }

    const difficulty = parseDifficulty(
      record.difficulty,
      `metadata[${index}].difficulty`,
    );
    const domainCode = requireNonemptyString(
      record.primary_class_cd,
      `metadata[${index}].primary_class_cd`,
    );
    const domain = requireNonemptyString(
      record.primary_class_cd_desc,
      `metadata[${index}].primary_class_cd_desc`,
    );
    const skillCode = requireNonemptyString(
      record.skill_cd,
      `metadata[${index}].skill_cd`,
    );
    const skill = requireNonemptyString(
      record.skill_desc,
      `metadata[${index}].skill_desc`,
    );

    result.push({
      id: externalId ?? `ibn:${ibn}`,
      ...(externalId ? { externalId } : { ibn: ibn as string }),
      section,
      domainCode,
      domain,
      skillCode,
      skill,
      difficulty,
    });
  });

  return result;
}

function parseDifficulty(value: unknown, field: string): Difficulty {
  if (value === "E") {
    return "easy";
  }
  if (value === "M") {
    return "medium";
  }
  if (value === "H") {
    return "hard";
  }

  throw invalidResponse(`${field} must be E, M, or H`);
}

function compareNormalizedIds(left: QuestionMeta, right: QuestionMeta): number {
  const leftId = normalizedId(left.id);
  const rightId = normalizedId(right.id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function parseStandardDetail(
  meta: QuestionMeta,
  value: unknown,
): QuestionDetail {
  const record = requireRecord(value, "standard question detail");
  const kind = parseQuestionKind(record.type, "standard detail.type");
  const stimulusHtml = optionalHtml(record.stimulus, "standard detail.stimulus");
  const promptHtml = requireHtml(record.stem, "standard detail.stem");
  const rationaleHtml = requireHtml(
    record.rationale,
    "standard detail.rationale",
  );
  const choices = parseStandardChoices(record.answerOptions, kind);
  const keys = requireStringArray(record.keys, "standard detail.keys");
  const returnedAnswers = requireStringArray(
    record.correct_answer,
    "standard detail.correct_answer",
  ).map((answer) => answer.trim());

  let correctAnswers: string[];
  if (kind === "multiple-choice") {
    const labelsFromKeys = keys.flatMap((key) => {
      const choice = choices.find(({ id }) => id === key);
      return choice ? [choice.label] : [];
    });
    correctAnswers = returnedAnswers.length
      ? returnedAnswers.map((answer) => answer.toUpperCase())
      : labelsFromKeys;
  } else {
    correctAnswers = returnedAnswers.length ? returnedAnswers : keys;
  }

  if (correctAnswers.length === 0) {
    throw invalidResponse("standard detail has no usable correct answer");
  }

  return {
    ...meta,
    kind,
    stimulusHtml,
    promptHtml,
    choices,
    correctAnswers: unique(correctAnswers),
    rationaleHtml,
  };
}

function parseStandardChoices(
  value: unknown,
  kind: QuestionDetail["kind"],
): QuestionChoice[] {
  if (value === null && kind === "student-produced-response") {
    return [];
  }
  if (!Array.isArray(value)) {
    throw invalidResponse("standard detail.answerOptions must be an array");
  }

  const choices = value.map((item, index) => {
    const record = requireRecord(item, `standard answerOptions[${index}]`);
    return {
      id: requireNonemptyString(
        record.id,
        `standard answerOptions[${index}].id`,
      ),
      label: String.fromCharCode("A".charCodeAt(0) + index),
      html: requireHtml(
        record.content,
        `standard answerOptions[${index}].content`,
      ),
    };
  });

  if (kind === "multiple-choice" && choices.length === 0) {
    throw invalidResponse("multiple-choice detail has no answer options");
  }
  if (kind === "student-produced-response" && choices.length !== 0) {
    throw invalidResponse("SPR detail must not have answer options");
  }

  return choices;
}

function parseLegacyDetail(
  meta: QuestionMeta,
  value: unknown,
): QuestionDetail {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidResponse("legacy question detail must be a nonempty array");
  }

  const record = requireRecord(value[0], "legacy question detail[0]");
  const answer = requireRecord(record.answer, "legacy detail.answer");
  const kind = parseQuestionKind(answer.style, "legacy detail.answer.style");
  const stimulusHtml = optionalHtml(record.body, "legacy detail.body");
  const promptHtml = requireHtml(record.prompt, "legacy detail.prompt");
  const rationaleHtml = requireHtml(
    answer.rationale,
    "legacy detail.answer.rationale",
  );
  const correctChoice = requireNonemptyString(
    answer.correct_choice,
    "legacy detail.answer.correct_choice",
  );

  let choices: QuestionChoice[] = [];
  if (kind === "multiple-choice") {
    const choiceRecord = requireRecord(
      answer.choices,
      "legacy detail.answer.choices",
    );
    choices = ["a", "b", "c", "d"].map((id) => {
      const choice = requireRecord(
        choiceRecord[id],
        `legacy detail.answer.choices.${id}`,
      );
      return {
        id,
        label: id.toUpperCase(),
        html: requireHtml(
          choice.body,
          `legacy detail.answer.choices.${id}.body`,
        ),
      };
    });
  }

  return {
    ...meta,
    kind,
    stimulusHtml,
    promptHtml,
    choices,
    correctAnswers: [
      kind === "multiple-choice"
        ? correctChoice.toUpperCase()
        : normalizeResponse(correctChoice),
    ],
    rationaleHtml,
  };
}

function parseQuestionKind(
  value: unknown,
  field: string,
): QuestionDetail["kind"] {
  if (typeof value !== "string") {
    throw invalidResponse(`${field} must be a string`);
  }

  const compact = value.toLowerCase().replace(/[\s_-]/g, "");
  if (compact === "mcq" || compact === "multiplechoice") {
    return "multiple-choice";
  }
  if (compact === "spr" || compact === "studentproducedresponse") {
    return "student-produced-response";
  }

  throw invalidResponse(`${field} is unsupported`);
}

function requireRecord(value: unknown, field: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidResponse(`${field} must be an object`);
  }
  return value as UnknownRecord;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw invalidResponse(`${field} must be an array of strings`);
  }
  return value;
}

function requireNonemptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalidResponse(`${field} must be a nonempty string`);
  }
  return value.trim();
}

function optionalTrimmedString(value: unknown, field: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw invalidResponse(`${field} must be a string, null, or undefined`);
  }

  return value.trim() || undefined;
}

function requireHtml(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw invalidResponse(`${field} must be a string`);
  }
  return value;
}

function optionalHtml(value: unknown, field: string): string {
  if (value === null || value === undefined) {
    return "";
  }
  return requireHtml(value, field);
}

function normalizedId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeResponse(value: string): string {
  return value.trim().replaceAll(",", "").replaceAll("−", "-").toUpperCase();
}

function parseFiniteNumber(value: string): number | null {
  const fraction = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(
    value,
  );
  const number = fraction
    ? Number(fraction[1]) / Number(fraction[2])
    : Number(value);

  return Number.isFinite(number) ? number : null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function invalidResponse(message: string, cause?: unknown): QBankError {
  return new QBankError(
    "invalid-response",
    message,
    undefined,
    cause === undefined ? undefined : { cause },
  );
}

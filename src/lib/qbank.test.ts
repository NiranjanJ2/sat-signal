import type { QuestionDetail, QuestionMeta } from "../types";
import {
  QBankError,
  fetchQuestionDetail,
  gradeResponse,
  loadCatalog,
} from "./qbank";

const API_BASE =
  "https://qbank-api.collegeboard.org/msreportingquestionbank-prod";

const metadata = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  questionId: "question-1",
  external_id: "released-z",
  ibn: null,
  difficulty: "M",
  primary_class_cd: "INI",
  primary_class_cd_desc: "Information and Ideas",
  skill_cd: "INF",
  skill_desc: "Inferences",
  ...overrides,
});

const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

type RequestKind = "lookup" | "reading" | "math";

const requestKind = (input: RequestInfo | URL, init?: RequestInit): RequestKind => {
  const url = String(input);

  if (url.endsWith("/questionbank/lookup")) {
    return "lookup";
  }

  const body = JSON.parse(String(init?.body)) as { test?: number };
  return body.test === 1 ? "reading" : "math";
};

const standardMeta: QuestionMeta = {
  id: "standard-id",
  externalId: "standard-id",
  section: "reading-writing",
  domainCode: "INI",
  domain: "Information and Ideas",
  skillCode: "INF",
  skill: "Inferences",
  difficulty: "medium",
};

const standardPayload = {
  type: "mcq",
  stimulus: "<p>Recorded stimulus</p>",
  stem: "<p>Recorded stem?</p>",
  rationale: "<p>Recorded rationale.</p>",
  answerOptions: [
    { id: "option-a", content: "<p>First</p>" },
    { id: "option-b", content: "<p>Second</p>" },
  ],
  keys: ["option-b"],
  correct_answer: ["B"],
};

const standardDetail: QuestionDetail = {
  ...standardMeta,
  kind: "multiple-choice",
  stimulusHtml: "<p>Recorded stimulus</p>",
  promptHtml: "<p>Recorded stem?</p>",
  choices: [
    { id: "option-a", label: "A", html: "<p>First</p>" },
    { id: "option-b", label: "B", html: "<p>Second</p>" },
  ],
  correctAnswers: ["B"],
  rationaleHtml: "<p>Recorded rationale.</p>",
};

describe("loadCatalog", () => {
  it("loads lookup and both SAT lists in parallel, excludes live ids, drops blank ids, and sorts normalized ids", async () => {
    const pending = new Map<
      RequestKind,
      (value: Response | PromiseLike<Response>) => void
    >();
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        requests.push({ input, init });
        return new Promise((resolve) => {
          pending.set(requestKind(input, init), resolve);
        });
      },
    ) as unknown as typeof fetch;

    const signal = new AbortController().signal;
    const catalogPromise = loadCatalog(signal, fetchImpl);

    expect(pending.size).toBe(3);
    pending.get("lookup")?.(
      response({
        readingLiveItems: ["RW-LIVE"],
        mathLiveItems: ["MATH-LIVE"],
      }),
    );
    pending.get("reading")?.(
      response([
        metadata(),
        metadata({ questionId: "live-rw", external_id: "rw-live" }),
        metadata({ questionId: "blank", external_id: "  ", ibn: null }),
        metadata({
          questionId: "legacy",
          external_id: "",
          ibn: " 022222-DC ",
          difficulty: "E",
          primary_class_cd: "CAS",
          primary_class_cd_desc: "Craft and Structure",
          skill_cd: "WIC",
          skill_desc: "Words in Context",
        }),
      ]),
    );
    pending.get("math")?.(
      response([
        metadata({
          questionId: "math-1",
          external_id: "Released-A",
          difficulty: "H",
          primary_class_cd: "H",
          primary_class_cd_desc: "Algebra",
          skill_cd: "LE",
          skill_desc: "Linear equations",
        }),
        metadata({
          questionId: "live-math",
          external_id: "math-live",
          primary_class_cd: "H",
          primary_class_cd_desc: "Algebra",
          skill_cd: "LE",
          skill_desc: "Linear equations",
        }),
      ]),
    );

    await expect(catalogPromise).resolves.toEqual([
      {
        id: "ibn:022222-DC",
        ibn: "022222-DC",
        section: "reading-writing",
        domainCode: "CAS",
        domain: "Craft and Structure",
        skillCode: "WIC",
        skill: "Words in Context",
        difficulty: "easy",
      },
      {
        id: "Released-A",
        externalId: "Released-A",
        section: "math",
        domainCode: "H",
        domain: "Algebra",
        skillCode: "LE",
        skill: "Linear equations",
        difficulty: "hard",
      },
      {
        id: "released-z",
        externalId: "released-z",
        section: "reading-writing",
        domainCode: "INI",
        domain: "Information and Ideas",
        skillCode: "INF",
        skill: "Inferences",
        difficulty: "medium",
      },
    ]);

    expect(requests).toHaveLength(3);
    expect(requests).toEqual(
      expect.arrayContaining([
        {
          input: `${API_BASE}/questionbank/lookup`,
          init: { method: "GET", signal },
        },
        {
          input: `${API_BASE}/questionbank/digital/get-questions`,
          init: {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              asmtEventId: 99,
              test: 1,
              domain: "INI,CAS,EOI,SEC",
            }),
            signal,
          },
        },
        {
          input: `${API_BASE}/questionbank/digital/get-questions`,
          init: {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              asmtEventId: 99,
              test: 2,
              domain: "H,P,Q,S",
            }),
            signal,
          },
        },
      ]),
    );
  });

  it("rejects malformed service responses with a typed validation error", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/questionbank/lookup")
        ? response({ readingLiveItems: "not-an-array", mathLiveItems: [] })
        : response([]),
    ) as unknown as typeof fetch;

    const catalogPromise = loadCatalog(new AbortController().signal, fetchImpl);

    await expect(catalogPromise).rejects.toBeInstanceOf(QBankError);
    await expect(catalogPromise).rejects.toMatchObject({
      name: "QBankError",
      code: "invalid-response",
    });
  });

  it("turns non-2xx responses into typed HTTP errors", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/questionbank/lookup")
        ? response({ message: "unavailable" }, 503)
        : response([]),
    ) as unknown as typeof fetch;

    await expect(
      loadCatalog(new AbortController().signal, fetchImpl),
    ).rejects.toMatchObject({
      code: "http",
      status: 503,
    });
  });

  it("propagates abort errors unchanged", async () => {
    const abortError = new DOMException("Stopped", "AbortError");
    const fetchImpl = vi.fn(async () => {
      throw abortError;
    }) as unknown as typeof fetch;

    await expect(
      loadCatalog(new AbortController().signal, fetchImpl),
    ).rejects.toBe(abortError);
  });

  it("propagates aborts that occur while reading a response body", async () => {
    const abortError = new DOMException("Stopped", "AbortError");
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw abortError;
      },
    })) as unknown as typeof fetch;

    await expect(
      loadCatalog(new AbortController().signal, fetchImpl),
    ).rejects.toBe(abortError);
  });
});

describe("fetchQuestionDetail", () => {
  it("fetches and normalizes exactly one standard detail", async () => {
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn(async () => response(standardPayload)) as unknown as
      typeof fetch;

    await expect(
      fetchQuestionDetail(standardMeta, signal, fetchImpl),
    ).resolves.toEqual(standardDetail);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${API_BASE}/questionbank/digital/get-question`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ external_id: "standard-id" }),
        signal,
      },
    );
  });

  it("normalizes omitted standard SPR answer options", async () => {
    const meta: QuestionMeta = {
      ...standardMeta,
      id: "spr-id",
      externalId: "spr-id",
      section: "math",
    };
    const fetchImpl = vi.fn(async () =>
      response({
        type: "spr",
        stimulus: null,
        stem: "<p>Enter a value.</p>",
        rationale: "<p>The answer is one half.</p>",
        keys: ["1/2"],
        correct_answer: ["0.5"],
      }),
    ) as unknown as typeof fetch;

    await expect(
      fetchQuestionDetail(
        meta,
        new AbortController().signal,
        fetchImpl,
      ),
    ).resolves.toEqual({
      ...meta,
      kind: "student-produced-response",
      stimulusHtml: "",
      promptHtml: "<p>Enter a value.</p>",
      choices: [],
      correctAnswers: ["0.5"],
      rationaleHtml: "<p>The answer is one half.</p>",
    });
  });

  it("fetches and normalizes exactly one legacy disclosed detail", async () => {
    const meta: QuestionMeta = {
      id: "ibn:022222-DC",
      ibn: "022222-DC",
      section: "math",
      domainCode: "H",
      domain: "Algebra",
      skillCode: "LE",
      skill: "Linear equations",
      difficulty: "easy",
    };
    const legacyPayload = [
      {
        item_id: "022222-DC",
        section: "Math",
        body: "<p>Recorded setup</p>",
        prompt: "<p>Recorded legacy prompt?</p>",
        answer: {
          style: "Multiple Choice",
          choices: {
            a: { body: "<p>2</p>" },
            b: { body: "<p>4</p>" },
            c: { body: "<p>5</p>" },
            d: { body: "<p>6</p>" },
          },
          correct_choice: "c",
          rationale: "<p>Choice C is correct.</p>",
        },
      },
    ];
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn(async () => response(legacyPayload)) as unknown as
      typeof fetch;

    await expect(fetchQuestionDetail(meta, signal, fetchImpl)).resolves.toEqual({
      ...meta,
      kind: "multiple-choice",
      stimulusHtml: "<p>Recorded setup</p>",
      promptHtml: "<p>Recorded legacy prompt?</p>",
      choices: [
        { id: "a", label: "A", html: "<p>2</p>" },
        { id: "b", label: "B", html: "<p>4</p>" },
        { id: "c", label: "C", html: "<p>5</p>" },
        { id: "d", label: "D", html: "<p>6</p>" },
      ],
      correctAnswers: ["C"],
      rationaleHtml: "<p>Choice C is correct.</p>",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://saic.collegeboard.org/disclosed/022222-DC.json",
      { method: "GET", signal },
    );
  });

  it("rejects a malformed standard detail", async () => {
    const fetchImpl = vi.fn(async () =>
      response({ ...standardPayload, answerOptions: "not-an-array" }),
    ) as unknown as typeof fetch;

    await expect(
      fetchQuestionDetail(
        standardMeta,
        new AbortController().signal,
        fetchImpl,
      ),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });
});

describe("gradeResponse", () => {
  it("grades a multiple-choice label or option id locally", () => {
    expect(gradeResponse(standardDetail, " B ")).toBe(true);
    expect(gradeResponse(standardDetail, "option-b")).toBe(true);
    expect(gradeResponse(standardDetail, "A")).toBe(false);
    expect(gradeResponse(standardDetail, "")).toBe(false);
  });

  it("normalizes student-produced responses and accepts finite numeric equivalents", () => {
    const detail: QuestionDetail = {
      ...standardMeta,
      kind: "student-produced-response",
      stimulusHtml: "",
      promptHtml: "<p>Enter a value.</p>",
      choices: [],
      correctAnswers: ["0.5", "−2", "1,000"],
      rationaleHtml: "<p>Use equivalent values.</p>",
    };

    expect(gradeResponse(detail, " 0.500 ")).toBe(true);
    expect(gradeResponse(detail, "-2")).toBe(true);
    expect(gradeResponse(detail, "1000")).toBe(true);
    expect(gradeResponse(detail, "1/2")).toBe(true);
    expect(gradeResponse(detail, "Infinity")).toBe(false);
    expect(gradeResponse(detail, " ")).toBe(false);
  });
});

import express from "express";
import type { CoachApiPayload } from "../src/lib/coach-contract";
import { generateCoachSummary } from "./coach";

const isNonemptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isCoachPayload = (value: unknown): value is CoachApiPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Record<keyof CoachApiPayload, unknown>>;
  return (
    isNonemptyString(candidate.question) &&
    Array.isArray(candidate.choices) &&
    candidate.choices.every(isNonemptyString) &&
    isNonemptyString(candidate.selectedAnswer) &&
    Array.isArray(candidate.correctAnswers) &&
    candidate.correctAnswers.length > 0 &&
    candidate.correctAnswers.every(isNonemptyString) &&
    isNonemptyString(candidate.topic) &&
    isNonemptyString(candidate.rationale)
  );
};

export function createApiApp(
  generateCoach: typeof generateCoachSummary = generateCoachSummary,
) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.post("/api/explain", async (request, response) => {
    if (!isCoachPayload(request.body)) {
      response.status(400).json({ error: "Invalid coach request." });
      return;
    }

    const controller = new AbortController();
    const abortModelWork = () => controller.abort();
    const abortIfDisconnected = () => {
      if (!response.writableEnded) {
        abortModelWork();
      }
    };
    request.once("aborted", abortModelWork);
    response.once("close", abortIfDisconnected);

    try {
      const result = await generateCoach(request.body, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        response.status(result.available ? 200 : 503).json(result);
      }
    } finally {
      request.off("aborted", abortModelWork);
      response.off("close", abortIfDisconnected);
    }
  });

  return app;
}

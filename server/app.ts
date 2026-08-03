import express from "express";
import type { CoachApiPayload } from "../src/lib/coach";
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
    candidate.choices.length === 4 &&
    candidate.choices.every(isNonemptyString) &&
    isNonemptyString(candidate.selectedAnswer) &&
    isNonemptyString(candidate.correctAnswer) &&
    isNonemptyString(candidate.topic) &&
    isNonemptyString(candidate.rationale)
  );
};

export function createApiApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.post("/api/explain", async (request, response) => {
    if (!isCoachPayload(request.body)) {
      response.status(400).json({ error: "Invalid coach request." });
      return;
    }

    const result = await generateCoachSummary(request.body);
    response.status(result.available ? 200 : 503).json(result);
  });

  return app;
}


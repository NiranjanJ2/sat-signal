import { describe, expect, it } from "vitest";
import { questions } from "./questions";

describe("question bank", () => {
  it("contains 24 original-format questions split evenly by section", () => {
    expect(questions).toHaveLength(24);
    expect(questions.filter(({ section }) => section === "reading-writing")).toHaveLength(12);
    expect(questions.filter(({ section }) => section === "math")).toHaveLength(12);
  });

  it("keeps identifiers unique and every item answerable", () => {
    expect(new Set(questions.map(({ id }) => id)).size).toBe(questions.length);

    for (const question of questions) {
      expect(question.id).toMatch(/^(rw|math)-/);
      expect(question.choices).toHaveLength(4);
      expect(question.choices.every((choice) => choice.trim().length > 0)).toBe(true);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
      expect(question.explanation.trim().length).toBeGreaterThan(30);
      expect(question.domain.trim()).not.toBe("");
      expect(question.skill.trim()).not.toBe("");
    }
  });

  it("covers each official-format content domain and every difficulty", () => {
    expect(new Set(questions.map(({ domain }) => domain))).toEqual(
      new Set([
        "Information and Ideas",
        "Craft and Structure",
        "Expression of Ideas",
        "Standard English Conventions",
        "Algebra",
        "Advanced Math",
        "Problem-Solving and Data Analysis",
        "Geometry and Trigonometry",
      ]),
    );
    expect(new Set(questions.map(({ difficulty }) => difficulty))).toEqual(
      new Set(["easy", "medium", "hard"]),
    );
  });
});


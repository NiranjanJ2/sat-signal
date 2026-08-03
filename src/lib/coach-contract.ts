export type CoachApiPayload = {
  question: string;
  choices: readonly string[];
  selectedAnswer: string;
  correctAnswers: readonly string[];
  topic: string;
  rationale: string;
};

export type Subject = "reading-writing" | "math";
export type Difficulty = "easy" | "medium" | "hard";

export type QuestionMeta = {
  id: string;
  externalId?: string;
  ibn?: string;
  section: Subject;
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: Difficulty;
};

export type QuestionChoice = {
  id: string;
  label: string;
  html: string;
};

export type QuestionDetail = QuestionMeta & {
  kind: "multiple-choice" | "student-produced-response";
  stimulusHtml: string;
  promptHtml: string;
  choices: QuestionChoice[];
  correctAnswers: string[];
  rationaleHtml: string;
};

export type Attempt = {
  id: string;
  questionId: string;
  response: string;
  correct: boolean;
  createdAt: string;
  durationMs?: number;
};

export type PracticeState = {
  version: 2;
  attempts: Attempt[];
  unresolvedIds: string[];
  missedHistoryIds: string[];
};

export type Filters = {
  subject: Subject | "All";
  domain: string | "All";
  skill: string | "All";
  difficulty: Difficulty | "All";
  mode: "all" | "missed";
};

export type TopicStat = {
  domain: string;
  subject: Subject;
  attempted: number;
  correct: number;
  accuracy: number | null;
};

export type ViewMode = "practice" | "review" | "memory";

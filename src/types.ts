export type Subject = "reading-writing" | "math";
export type Difficulty = "easy" | "medium" | "hard";
export type AnswerIndex = 0 | 1 | 2 | 3;

export type Question = {
  id: string;
  section: Subject;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  prompt: string;
  passage?: string;
  choices: readonly [string, string, string, string];
  answerIndex: AnswerIndex;
  explanation: string;
};

export type Attempt = {
  id: string;
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  createdAt: string;
};

export type PracticeState = {
  version: 1;
  attempts: Attempt[];
  unresolvedIds: string[];
  missedHistoryIds: string[];
};

export type Filters = {
  subject: Subject | "All";
  domain: string | "All";
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

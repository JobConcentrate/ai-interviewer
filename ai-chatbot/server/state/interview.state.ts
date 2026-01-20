export enum InterviewStage {
  Introduction = 0,
  SkillsExperience = 1,
  Technical = 2,
  Expectations = 3,
  CandidateQuestions = 4,
  Ended = 5
}

export type AiReply = {
  message: string;
  questionAnswered: boolean;
};

export type InterviewRating = {
  rating: number;
  comment: string;
};

export type HistoryItem = {
  role: "user" | "assistant";
  message: string;
};

export class InterviewState {
  currentStage = InterviewStage.Introduction;
  questionsAskedInStage = 0;
  ended = false;
  history: HistoryItem[] = []
  role?: string;
  employer?: string;
  candidateName?: string;
  candidateEmail?: string;
  interviewId?: string;
  employerId?: string;
  loadedFromDb = false;
}

export interface OpenAiResponse {
  choices: OpenAiChoice[];
}

interface OpenAiChoice {
  message: { role: "system" | "user" | "assistant"; content: string };
}

export type Message = { role: "user" | "ai"; content: string };

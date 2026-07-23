export interface GeneratedQuestion {
  id: string;
  questionText: string;
  options: string[];
}

export interface AiGeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export interface GenerateQuestionsResult {
  sessionId: string;
  questions: GeneratedQuestion[];
}

export interface SubmitAnswersResult {
  sessionId: string;
  score: number;
  isCompleted: boolean;
}

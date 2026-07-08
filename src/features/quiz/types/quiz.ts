export type QuizOrder = "original" | "random";
export type QuizRevealMode = "during" | "after";

export type QuizConfig = {
	order: QuizOrder;
	quantity: number;
	topicFilter: string | null;
	revealMode: QuizRevealMode;
	seed?: number;
};

export type AttemptStatus = "in_progress" | "completed";

export type Attempt = {
	id: string;
	examId: string;
	config: QuizConfig;
	totalQuestions: number;
	answeredQuestions: number;
	correctAnswers: number;
	status: AttemptStatus;
	startedAt: string;
};

export type QuestionInAttempt = {
	id: string;
	question: string;
	options: Array<{ id: string; text: string; explanation?: string | null }>;
	correctOptionIds: string[];
	selectedOptionIds: string[];
	scoringMode: "exact" | "partial";
	topic: string | null;
	explanation: string | null;
	deepExplanation?: string | null;
};

/** @deprecated Use QuestionInAttempt directly. */
export type QuizQuestion = QuestionInAttempt;

export type ActiveAttempt = {
	attempt: Attempt;
	questions: QuestionInAttempt[];
};

export type AttemptAnswer = {
	id: string;
	attemptId: string;
	questionId: string;
	selectedOptionIds: string[];
	credit: number;
	correct: boolean;
	answeredAt: string;
};

export type AttemptResultQuestion = {
	questionId: string;
	question: string;
	options: Array<{ id: string; text: string; explanation?: string | null }>;
	correctOptionIds: string[];
	selectedOptionIds: string[];
	scoringMode: "exact" | "partial";
	topic: string | null;
	credit: number;
	explanation: string | null;
	deepExplanation?: string | null;
};

export type AttemptSummary = {
	id: string;
	status: AttemptStatus;
	totalQuestions: number;
	answeredQuestions: number;
	correctAnswers: number;
	scorePercent: number;
	startedAt: string | null;
};

export type AttemptResult = Attempt & {
	scorePercent: number;
	questions: AttemptResultQuestion[];
};

export type QuizConfigInput = Omit<QuizConfig, "order" | "revealMode"> & {
	order?: QuizOrder;
	revealMode?: QuizRevealMode;
};

export type StartQuizAttemptInput = {
	examId: string;
} & Partial<QuizConfig>;

export type SubmitAnswerInput = {
	attemptId: string;
	questionId: string;
	selectedOptions: string[];
};

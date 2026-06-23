export type QuestionOption = { key: string; text: string };

export type QuestionDetail = {
	id: string;
	question: string;
	options: QuestionOption[];
	answers: string[];
	topic: string | null;
	scoringMode: "exact" | "partial";
	explanation: string | null;
	deepExplanation: string | null;
};

export type ExamDetail = {
	id: string;
	name: string;
	createdAt: string | null;
	questionCount: number;
	questions: QuestionDetail[];
};

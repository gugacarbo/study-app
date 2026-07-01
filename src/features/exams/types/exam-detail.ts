export type QuestionOption = { key: string; text: string; explanation?: string | null };

export type QuestionDetail = {
	id: string;
	question: string;
	options: QuestionOption[];
	answers: string[];
	topicId?: string | null;
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

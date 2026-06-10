export interface ExamRecord {
	id: number;
	name: string;
	source: string | null;
	created_at: string | null;
}

export interface TopicStats {
	topic: string;
	attempts: number;
	completedAnswers: number;
	correctAnswers: number;
	accuracy: number;
}

export type AttemptStatus = "in_progress" | "completed" | "abandoned";

export interface AttemptStatsSummary {
	totalAttempts: number;
	completedAttempts: number;
	incompleteAttempts: number;
	correctAnswers: number;
	answeredQuestions: number;
	overallAccuracy: number;
}

export interface ExamFull {
	id: number;
	name: string;
	source: string | null;
	created_at: string | null;
	questionCount: number;
	topics: string[];
	files: FileInfo[];
	questions: ParsedQuestion[];
	stats: AttemptStatsSummary & {
		totalQuestions: number;
		topicStats: TopicStats[];
	};
}

export interface FileRecord {
	id: number;
	exam_id: number | null;
	name: string;
	r2_key: string;
	mime_type: string | null;
	size: number | null;
	created_at: string | null;
}

export interface FileInfo {
	id: number;
	exam_id: number | null;
	name: string;
	r2_key: string;
	mime_type: string | null;
	size: number | null;
	created_at: string | null;
}

export interface ExamDetail {
	id: number;
	name: string;
	source: string | null;
	created_at: string | null;
	questionCount: number;
	topics: string[];
	files: FileInfo[];
}

export interface LLMLogInsert {
	callId: string;
	callType: string;
	provider: string;
	model: string;
	baseUrl?: string;
	systemPrompt?: string;
	requestPayload?: string;
	responsePayload?: string;
	durationMs?: number;
	chunks?: number;
	finalChars?: number;
	tokenMeta?: string;
	errorMessage?: string;
	status?: "pending" | "success" | "failed" | "cancelled";
}

interface PaginationMeta {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
	items: T[];
	pagination: PaginationMeta;
}

export interface ListExamsFilters {
	page?: number;
	pageSize?: number;
	nameContains?: string;
	source?: string;
	createdFrom?: string;
	createdTo?: string;
}

export interface ListQuestionsFilters {
	page?: number;
	pageSize?: number;
	examId?: number;
	topic?: string;
	textContains?: string;
	createdFrom?: string;
	createdTo?: string;
	includeAnswer?: boolean;
}

export interface ListAnswerKeysFilters {
	page?: number;
	pageSize?: number;
	examId?: number;
	questionId?: number;
	topic?: string;
	textContains?: string;
}

export interface ListAttemptsFilters {
	page?: number;
	pageSize?: number;
	examId?: number;
	topic?: string;
	status?: AttemptStatus;
	startedFrom?: string;
	startedTo?: string;
}

export interface QuestionListItem {
	id: number;
	exam_id: number | null;
	question: string;
	options: string[];
	explanation: string;
	deepExplanation: string;
	topic: string;
	created_at: string | null;
	answers?: string[];
	scoringMode?: "exact" | "partial";
}

export interface AnswerKeyListItem {
	id: number;
	exam_id: number | null;
	topic: string | null;
	question: string;
	answers: string[];
	scoringMode: "exact" | "partial";
	created_at: string | null;
}

export interface AttemptListItem {
	id: number;
	exam_id: number | null;
	topic: string | null;
	total_questions: number;
	answered_questions: number;
	correct_answers: number;
	status: AttemptStatus;
	started_at: string | null;
	completed_at: string | null;
	updated_at: string | null;
	accuracy: number;
}

interface ParsedQuestion {
	id: number;
	exam_id: number | null;
	question: string;
	options: string[];
	answers: string[];
	scoringMode: "exact" | "partial";
	explanation: string;
	deepExplanation: string;
	topic: string;
}

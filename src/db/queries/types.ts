import type { RequestParams, ThinkingEffortLevel } from "@/lib/validation";

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

export interface AiProviderRecord {
	id: number;
	name: string;
	base_url: string;
	api_key: string;
	enabled: boolean;
	created_at: string | null;
	updated_at: string | null;
}

export interface AiProviderPublic {
	id: number;
	name: string;
	baseUrl: string;
	hasApiKey: boolean;
	enabled: boolean;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface AiModelRecord {
	id: number;
	provider_id: number;
	model_id: string;
	display_name: string;
	context_window: number | null;
	max_output_tokens: number | null;
	input_cost_per_million: number | null;
	output_cost_per_million: number | null;
	thinking_effort_levels: string | null;
	default_thinking_effort: string | null;
	thinking_enabled: boolean | null;
	thinking_param_name: string | null;
	enabled: boolean;
	metadata: string | null;
	request_params: string | null;
	created_at: string | null;
	updated_at: string | null;
}

export interface AiModelWithProvider extends AiModelRecord {
	provider_name: string;
	provider_base_url: string;
	provider_enabled: boolean;
}

export interface AiModelPublic {
	id: number;
	providerId: number;
	providerName: string;
	modelId: string;
	displayName: string;
	contextWindow: number | null;
	maxOutputTokens: number | null;
	inputCostPerMillion: number | null;
	outputCostPerMillion: number | null;
	thinkingEffortLevels: ThinkingEffortLevel[];
	defaultThinkingEffort: ThinkingEffortLevel | null;
	thinkingEnabled: boolean | null;
	thinkingParamName: string | null;
	enabled: boolean;
	metadata: string | null;
	requestParams: RequestParams;
}

export interface AiModelResolved extends AiModelPublic {
	providerBaseUrl: string;
	providerApiKey: string;
}

export type LLMLogStatus = "pending" | "success" | "failed" | "cancelled";

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
	status?: LLMLogStatus;
}

export interface LLMLogSummary {
	id: number;
	call_id: string;
	call_type: string;
	provider: string;
	model: string;
	base_url: string | null;
	duration_ms: number | null;
	chunks: number | null;
	final_chars: number | null;
	token_meta: string | null;
	error_message: string | null;
	status: LLMLogStatus;
	created_at: string | null;
}

export interface LLMLogDetail extends LLMLogSummary {
	system_prompt: string | null;
	request_payload: string | null;
	response_payload: string | null;
}

export interface ListLLMLogsFilters {
	page?: number;
	pageSize?: number;
	status?: LLMLogStatus;
	callType?: string;
	provider?: string;
	model?: string;
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

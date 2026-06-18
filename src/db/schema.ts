import { sql } from "drizzle-orm";
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// --- Better Auth ---

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", {
		mode: "timestamp_ms",
	}),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", {
		mode: "timestamp_ms",
	}),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

// --- RBAC ---

export const roles = sqliteTable(
	"roles",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		name: text("name").notNull(),
	},
	(table) => [uniqueIndex("uq_roles_key").on(table.key)],
);

export const permissions = sqliteTable(
	"permissions",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		description: text("description"),
	},
	(table) => [uniqueIndex("uq_permissions_key").on(table.key)],
);

export const rolePermissions = sqliteTable(
	"role_permissions",
	{
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
		permissionId: text("permission_id")
			.notNull()
			.references(() => permissions.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("idx_role_permissions_permission_id").on(table.permissionId),
	],
);

export const userRoles = sqliteTable(
	"user_roles",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		roleId: text("role_id")
			.notNull()
			.references(() => roles.id, { onDelete: "cascade" }),
	},
	(table) => [index("idx_user_roles_role_id").on(table.roleId)],
);

// --- Domain ---

export const exams = sqliteTable(
	"exams",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		source: text("source"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_exams_user_id").on(table.userId),
		index("idx_exams_user_created").on(table.userId, table.createdAt),
	],
);

export const questions = sqliteTable(
	"questions",
	{
		id: text("id").primaryKey(),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		question: text("question").notNull(),
		options: text("options").notNull(),
		answers: text("answers").notNull(),
		scoringMode: text("scoring_mode").notNull().default("exact"),
		explanation: text("explanation"),
		deepExplanation: text("deep_explanation"),
		topic: text("topic"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_questions_exam_id").on(table.examId)],
);

export const attempts = sqliteTable(
	"attempts",
	{
		id: text("id").primaryKey(),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		topic: text("topic"),
		totalQuestions: integer("total_questions").notNull(),
		answeredQuestions: integer("answered_questions").notNull().default(0),
		correctAnswers: real("correct_answers").notNull().default(0),
		status: text("status").notNull().default("in_progress"),
		startedAt: text("started_at").default(sql`CURRENT_TIMESTAMP`),
		completedAt: text("completed_at"),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_attempts_exam_id").on(table.examId),
		index("idx_attempts_status").on(table.status),
	],
);

export const attemptAnswers = sqliteTable(
	"attempt_answers",
	{
		id: text("id").primaryKey(),
		attemptId: text("attempt_id")
			.notNull()
			.references(() => attempts.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		userAnswer: text("user_answer").notNull(),
		correct: integer("correct", { mode: "boolean" }).notNull(),
		credit: real("credit"),
		answeredAt: text("answered_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_attempt_answers_attempt_id").on(table.attemptId),
		index("idx_attempt_answers_question_id").on(table.questionId),
		uniqueIndex("uq_attempt_answers_attempt_question").on(
			table.attemptId,
			table.questionId,
		),
	],
);

export const files = sqliteTable(
	"files",
	{
		id: text("id").primaryKey(),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		r2Key: text("r2_key").notNull(),
		mimeType: text("mime_type"),
		size: integer("size"),
		ttlSeconds: integer("ttl_seconds").notNull().default(0),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_files_exam_id").on(table.examId),
		uniqueIndex("uq_files_r2_key").on(table.r2Key),
		index("idx_files_ttl_purge").on(table.ttlSeconds, table.createdAt),
	],
);

export const aiProviders = sqliteTable(
	"ai_providers",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		baseUrl: text("base_url").notNull(),
		apiKey: text("api_key").notNull(),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_ai_providers_user_id").on(table.userId)],
);

export const aiModels = sqliteTable(
	"ai_models",
	{
		id: text("id").primaryKey(),
		providerId: text("provider_id")
			.notNull()
			.references(() => aiProviders.id, { onDelete: "cascade" }),
		modelId: text("model_id").notNull(),
		displayName: text("display_name").notNull(),
		contextWindow: integer("context_window"),
		maxOutputTokens: integer("max_output_tokens"),
		inputCostPerMillion: real("input_cost_per_million"),
		outputCostPerMillion: real("output_cost_per_million"),
		thinkingEffortLevels: text("thinking_effort_levels"),
		defaultThinkingEffort: text("default_thinking_effort"),
		thinkingEnabled: integer("thinking_enabled", { mode: "boolean" }),
		thinkingParamName: text("thinking_param_name"),
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
		metadata: text("metadata"),
		requestParams: text("request_params"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_ai_models_provider_id").on(table.providerId),
		uniqueIndex("uq_ai_models_provider_model").on(
			table.providerId,
			table.modelId,
		),
	],
);

export const config = sqliteTable("config", {
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	key: text("key").notNull(),
	value: text("value").notNull(),
});

export const memoryProfile = sqliteTable("memory_profile", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	r2Key: text("r2_key").notNull(),
	searchText: text("search_text").notNull().default(""),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const memorySessions = sqliteTable(
	"memory_sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sessionDate: text("session_date").notNull(),
		topic: text("topic").notNull(),
		examName: text("exam_name").notNull(),
		totalQuestions: integer("total_questions").notNull(),
		correctAnswers: integer("correct_answers").notNull(),
		accuracy: integer("accuracy").notNull(),
		duration: integer("duration"),
		r2Key: text("r2_key").notNull(),
		searchText: text("search_text").notNull().default(""),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("idx_memory_sessions_user_topic").on(table.userId, table.topic)],
);

export const memoryTopicNotes = sqliteTable(
	"memory_topic_notes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		topicSlug: text("topic_slug").notNull(),
		topic: text("topic").notNull(),
		r2Key: text("r2_key").notNull(),
		searchText: text("search_text").notNull().default(""),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("uq_memory_topic_notes_user_slug").on(
			table.userId,
			table.topicSlug,
		),
	],
);

export const memoryDocuments = sqliteTable(
	"memory_documents",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		docType: text("doc_type").notNull(),
		name: text("name").notNull(),
		topic: text("topic"),
		r2Key: text("r2_key").notNull(),
		searchText: text("search_text").notNull().default(""),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_memory_documents_user_type").on(table.userId, table.docType),
	],
);

export const chatConversations = sqliteTable(
	"chat_conversations",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		r2Key: text("r2_key").notNull(),
		messageCount: integer("message_count").notNull().default(0),
		contextKey: text("context_key"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_chat_conversations_user_updated").on(
			table.userId,
			table.updatedAt,
		),
		uniqueIndex("uq_chat_conversations_r2_key").on(table.r2Key),
	],
);

export const backgroundJobs = sqliteTable(
	"background_jobs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		status: text("status").notNull(),
		phase: text("phase"),
		error: text("error"),
		metadata: text("metadata"),
		cancelRequestedAt: text("cancel_requested_at"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_background_jobs_user_created").on(table.userId, table.createdAt),
		index("idx_background_jobs_user_status").on(table.userId, table.status),
	],
);

export const backgroundJobEvents = sqliteTable(
	"background_job_events",
	{
		id: text("id").primaryKey(),
		jobId: text("job_id")
			.notNull()
			.references(() => backgroundJobs.id, { onDelete: "cascade" }),
		seq: integer("seq").notNull(),
		payload: text("payload").notNull(),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("uq_background_job_events_job_seq").on(table.jobId, table.seq),
	],
);

export const llmLogs = sqliteTable(
	"llm_logs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		callId: text("call_id").notNull(),
		callType: text("call_type").notNull(),
		provider: text("provider").notNull(),
		model: text("model").notNull(),
		baseUrl: text("base_url"),
		systemPrompt: text("system_prompt"),
		requestPayload: text("request_payload"),
		responsePayload: text("response_payload"),
		durationMs: integer("duration_ms"),
		chunks: integer("chunks"),
		finalChars: integer("final_chars"),
		tokenMeta: text("token_meta"),
		errorMessage: text("error_message"),
		status: text("status").notNull().default("pending"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_llm_logs_user_created").on(table.userId, table.createdAt),
		uniqueIndex("uq_llm_logs_call_id").on(table.callId),
	],
);

export const r2OperationLogs = sqliteTable(
	"r2_operation_logs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		bucket: text("bucket").notNull(),
		operation: text("operation").notNull(),
		objectKey: text("object_key").notNull(),
		bytes: integer("bytes"),
		status: text("status").notNull(),
		durationMs: integer("duration_ms"),
		errorMessage: text("error_message"),
		createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_r2_operation_logs_user_created").on(table.userId, table.createdAt),
		index("idx_r2_operation_logs_bucket_created").on(
			table.bucket,
			table.createdAt,
		),
	],
);

export const authSchema = {
	user,
	session,
	account,
	verification,
};

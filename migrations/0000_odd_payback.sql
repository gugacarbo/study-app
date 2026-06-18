CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`display_name` text NOT NULL,
	`context_window` integer,
	`max_output_tokens` integer,
	`input_cost_per_million` real,
	`output_cost_per_million` real,
	`thinking_effort_levels` text,
	`default_thinking_effort` text,
	`thinking_enabled` integer,
	`thinking_param_name` text,
	`enabled` integer DEFAULT true NOT NULL,
	`metadata` text,
	`request_params` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_models_provider_id` ON `ai_models` (`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ai_models_provider_model` ON `ai_models` (`provider_id`,`model_id`);--> statement-breakpoint
CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_providers_user_id` ON `ai_providers` (`user_id`);--> statement-breakpoint
CREATE TABLE `attempt_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`user_answer` text NOT NULL,
	`correct` integer NOT NULL,
	`credit` real,
	`answered_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attempt_answers_attempt_id` ON `attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `idx_attempt_answers_question_id` ON `attempt_answers` (`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_attempt_answers_attempt_question` ON `attempt_answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`topic` text,
	`total_questions` integer NOT NULL,
	`answered_questions` integer DEFAULT 0 NOT NULL,
	`correct_answers` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_exam_id` ON `attempts` (`exam_id`);--> statement-breakpoint
CREATE INDEX `idx_attempts_status` ON `attempts` (`status`);--> statement-breakpoint
CREATE TABLE `background_job_events` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`seq` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`job_id`) REFERENCES `background_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_background_job_events_job_seq` ON `background_job_events` (`job_id`,`seq`);--> statement-breakpoint
CREATE TABLE `background_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`phase` text,
	`error` text,
	`metadata` text,
	`cancel_requested_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_background_jobs_user_created` ON `background_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_background_jobs_user_status` ON `background_jobs` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`r2_key` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`context_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_conversations_user_updated` ON `chat_conversations` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_chat_conversations_r2_key` ON `chat_conversations` (`r2_key`);--> statement-breakpoint
CREATE TABLE `config` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_exams_user_id` ON `exams` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_exams_user_created` ON `exams` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`name` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text,
	`size` integer,
	`ttl_seconds` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_files_exam_id` ON `files` (`exam_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_files_r2_key` ON `files` (`r2_key`);--> statement-breakpoint
CREATE INDEX `idx_files_ttl_purge` ON `files` (`ttl_seconds`,`created_at`);--> statement-breakpoint
CREATE TABLE `llm_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`call_id` text NOT NULL,
	`call_type` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`base_url` text,
	`system_prompt` text,
	`request_payload` text,
	`response_payload` text,
	`duration_ms` integer,
	`chunks` integer,
	`final_chars` integer,
	`token_meta` text,
	`error_message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_llm_logs_user_created` ON `llm_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_llm_logs_call_id` ON `llm_logs` (`call_id`);--> statement-breakpoint
CREATE TABLE `memory_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`name` text NOT NULL,
	`topic` text,
	`r2_key` text NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_memory_documents_user_type` ON `memory_documents` (`user_id`,`doc_type`);--> statement-breakpoint
CREATE TABLE `memory_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `memory_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_date` text NOT NULL,
	`topic` text NOT NULL,
	`exam_name` text NOT NULL,
	`total_questions` integer NOT NULL,
	`correct_answers` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`duration` integer,
	`r2_key` text NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_memory_sessions_user_topic` ON `memory_sessions` (`user_id`,`topic`);--> statement-breakpoint
CREATE TABLE `memory_topic_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic_slug` text NOT NULL,
	`topic` text NOT NULL,
	`r2_key` text NOT NULL,
	`search_text` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_memory_topic_notes_user_slug` ON `memory_topic_notes` (`user_id`,`topic_slug`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_permissions_key` ON `permissions` (`key`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`answers` text NOT NULL,
	`scoring_mode` text DEFAULT 'exact' NOT NULL,
	`explanation` text,
	`deep_explanation` text,
	`topic` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_questions_exam_id` ON `questions` (`exam_id`);--> statement-breakpoint
CREATE TABLE `r2_operation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bucket` text NOT NULL,
	`operation` text NOT NULL,
	`object_key` text NOT NULL,
	`bytes` integer,
	`status` text NOT NULL,
	`duration_ms` integer,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_r2_operation_logs_user_created` ON `r2_operation_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_r2_operation_logs_bucket_created` ON `r2_operation_logs` (`bucket`,`created_at`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_role_permissions_permission_id` ON `role_permissions` (`permission_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_roles_key` ON `roles` (`key`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_roles_role_id` ON `user_roles` (`role_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

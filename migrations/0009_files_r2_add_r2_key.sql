CREATE TABLE `llm_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
CREATE INDEX `idx_llm_logs_created_at` ON `llm_logs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_llm_logs_call_id` ON `llm_logs` (`call_id`);--> statement-breakpoint
CREATE TABLE `memory_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc_type` text NOT NULL,
	`name` text NOT NULL,
	`topic` text,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_memory_documents_type` ON `memory_documents` (`doc_type`);--> statement-breakpoint
CREATE TABLE `memory_profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `memory_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_date` text NOT NULL,
	`topic` text NOT NULL,
	`exam_name` text NOT NULL,
	`total_questions` integer NOT NULL,
	`correct_answers` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`duration` integer,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_memory_sessions_topic` ON `memory_sessions` (`topic`);--> statement-breakpoint
CREATE TABLE `memory_topic_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_slug` text NOT NULL,
	`topic` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_topic_notes_topic_slug_unique` ON `memory_topic_notes` (`topic_slug`);--> statement-breakpoint
CREATE INDEX `idx_memory_topic_notes_topic` ON `memory_topic_notes` (`topic`);--> statement-breakpoint
ALTER TABLE `files` ADD `r2_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_files_r2_key` ON `files` (`r2_key`);--> statement-breakpoint
ALTER TABLE `questions` ADD `deep_explanation` text;
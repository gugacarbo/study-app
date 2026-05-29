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
	`status` text NOT NULL DEFAULT 'pending',
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_llm_logs_created_at` ON `llm_logs` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_llm_logs_call_id` ON `llm_logs` (`call_id`);

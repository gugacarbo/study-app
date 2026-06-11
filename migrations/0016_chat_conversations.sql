CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`r2_key` text NOT NULL,
	`message_count` integer NOT NULL DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX `idx_chat_conversations_updated_at` ON `chat_conversations` (`updated_at`);
CREATE UNIQUE INDEX `uq_chat_conversations_r2_key` ON `chat_conversations` (`r2_key`);

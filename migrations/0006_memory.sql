CREATE TABLE `memory_profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);

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
CREATE INDEX `idx_memory_sessions_topic` ON `memory_sessions` (`topic`);

CREATE TABLE `memory_topic_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_slug` text NOT NULL,
	`topic` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX `memory_topic_notes_topic_slug_unique` ON `memory_topic_notes` (`topic_slug`);
CREATE INDEX `idx_memory_topic_notes_topic` ON `memory_topic_notes` (`topic`);

CREATE TABLE `memory_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doc_type` text NOT NULL,
	`name` text NOT NULL,
	`topic` text,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX `idx_memory_documents_type` ON `memory_documents` (`doc_type`);

DROP TABLE IF EXISTS `attempt_answers`;
--> statement-breakpoint
DROP TABLE IF EXISTS `attempts`;
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer,
	`topic` text,
	`total_questions` integer NOT NULL,
	`answered_questions` integer DEFAULT 0 NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_exam_id` ON `attempts` (`exam_id`);
--> statement-breakpoint
CREATE INDEX `idx_attempts_status` ON `attempts` (`status`);
--> statement-breakpoint
CREATE TABLE `attempt_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`user_answer` text NOT NULL,
	`correct` integer NOT NULL,
	`answered_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attempt_answers_attempt_id` ON `attempt_answers` (`attempt_id`);
--> statement-breakpoint
CREATE INDEX `idx_attempt_answers_question_id` ON `attempt_answers` (`question_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_attempt_answers_attempt_question` ON `attempt_answers` (`attempt_id`,`question_id`);

CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer,
	`user_answer` text NOT NULL,
	`correct` integer NOT NULL,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_question_id` ON `attempts` (`question_id`);

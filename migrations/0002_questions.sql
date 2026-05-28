CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`answer` text NOT NULL,
	`explanation` text,
	`topic` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_questions_exam_id` ON `questions` (`exam_id`);

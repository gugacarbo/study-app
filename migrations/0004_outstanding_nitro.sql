CREATE TABLE `question_improvement_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`question_id` text NOT NULL,
	`job_id` text NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`original_snapshot` text NOT NULL,
	`improved_snapshot` text NOT NULL,
	`summary` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_question_improvement_drafts_exam` ON `question_improvement_drafts` (`exam_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_question_improvement_drafts_question` ON `question_improvement_drafts` (`question_id`,`status`);
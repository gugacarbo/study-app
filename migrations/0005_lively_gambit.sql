PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `attempts_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`topic` text,
	`total_questions` integer NOT NULL,
	`answered_questions` integer NOT NULL DEFAULT 0,
	`correct_answers` real NOT NULL DEFAULT 0,
	`status` text NOT NULL DEFAULT 'in_progress',
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `attempts_new` (`id`, `user_id`, `exam_id`, `config`, `topic`, `total_questions`, `answered_questions`, `correct_answers`, `status`, `started_at`, `completed_at`, `updated_at`)
SELECT `a`.`id`, `e`.`user_id`, `a`.`exam_id`, '{}', `a`.`topic`, `a`.`total_questions`, `a`.`answered_questions`, `a`.`correct_answers`, `a`.`status`, `a`.`started_at`, `a`.`completed_at`, `a`.`updated_at`
FROM `attempts` AS `a`
JOIN `exams` AS `e` ON `e`.`id` = `a`.`exam_id`;
--> statement-breakpoint
CREATE TABLE `attempt_answers_new` (
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
INSERT INTO `attempt_answers_new` (`id`, `attempt_id`, `question_id`, `user_answer`, `correct`, `credit`, `answered_at`)
SELECT `id`, `attempt_id`, `question_id`, `user_answer`, `correct`, `credit`, `answered_at` FROM `attempt_answers`;
--> statement-breakpoint
DROP TABLE `attempt_answers`;
--> statement-breakpoint
DROP TABLE `attempts`;
--> statement-breakpoint
ALTER TABLE `attempts_new` RENAME TO `attempts`;
--> statement-breakpoint
ALTER TABLE `attempt_answers_new` RENAME TO `attempt_answers`;
--> statement-breakpoint
CREATE INDEX `idx_attempts_user_id` ON `attempts` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_attempts_exam_id` ON `attempts` (`exam_id`);
--> statement-breakpoint
CREATE INDEX `idx_attempts_user_exam_status` ON `attempts` (`user_id`, `exam_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_attempts_status` ON `attempts` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_attempt_answers_attempt_id` ON `attempt_answers` (`attempt_id`);
--> statement-breakpoint
CREATE INDEX `idx_attempt_answers_question_id` ON `attempt_answers` (`question_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_attempt_answers_attempt_question` ON `attempt_answers` (`attempt_id`, `question_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
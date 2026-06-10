ALTER TABLE `questions` ADD COLUMN `answers` TEXT;
--> statement-breakpoint
ALTER TABLE `questions` ADD COLUMN `scoring_mode` TEXT NOT NULL DEFAULT 'exact';
--> statement-breakpoint
UPDATE `questions` SET `answers` = json_array(`answer`) WHERE `answers` IS NULL;
--> statement-breakpoint
ALTER TABLE `questions` DROP COLUMN `answer`;
--> statement-breakpoint
ALTER TABLE `attempt_answers` ADD COLUMN `credit` REAL;
--> statement-breakpoint
UPDATE `attempt_answers` SET `credit` = CASE WHEN `correct` = 1 THEN 1.0 ELSE 0.0 END WHERE `credit` IS NULL;
--> statement-breakpoint
-- SQLite stores numeric values flexibly; correct_answers becomes REAL in Drizzle.
-- Wave 1 quiz: refreshAttemptProgress should use SUM(credit) instead of SUM(correct).

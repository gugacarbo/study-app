CREATE TABLE `question_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_question_topics_normalized_name` ON `question_topics` (`normalized_name`);
--> statement-breakpoint
ALTER TABLE `questions` ADD `topic_id` text REFERENCES question_topics(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_questions_topic_id` ON `questions` (`topic_id`);
--> statement-breakpoint
INSERT INTO `question_topics` (`id`, `name`, `normalized_name`)
SELECT lower(hex(randomblob(16))), MIN(trim(`topic`)), lower(trim(`topic`))
FROM `questions`
WHERE `topic` IS NOT NULL AND trim(`topic`) <> ''
GROUP BY lower(trim(`topic`));
--> statement-breakpoint
UPDATE `questions`
SET `topic_id` = (
	SELECT `qt`.`id`
	FROM `question_topics` AS `qt`
	WHERE `qt`.`normalized_name` = lower(trim(`questions`.`topic`))
	LIMIT 1
)
WHERE `topic` IS NOT NULL AND trim(`topic`) <> '';

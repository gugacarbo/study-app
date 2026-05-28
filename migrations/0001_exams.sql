CREATE TABLE `exams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`source` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exam_id` integer,
	`name` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text,
	`size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_files`("id", "exam_id", "name", "r2_key", "mime_type", "size", "created_at")
SELECT
  "id",
  "exam_id",
  "name",
  CASE
    WHEN "r2_key" IS NULL OR TRIM("r2_key") = '' THEN 'files/legacy-' || "id"
    ELSE "r2_key"
  END,
  "mime_type",
  "size",
  "created_at"
FROM `files`;--> statement-breakpoint
DROP TABLE `files`;--> statement-breakpoint
ALTER TABLE `__new_files` RENAME TO `files`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_files_exam_id` ON `files` (`exam_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_files_r2_key` ON `files` (`r2_key`);

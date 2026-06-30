ALTER TABLE `background_jobs` ADD `worker_id` text;
--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `processing_started_at` text;
--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `heartbeat_at` text;
--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `lease_expires_at` text;
--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `run_attempts` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `recovery_attempts` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `background_jobs` ADD `last_recovered_at` text;

ALTER TABLE `files` ADD `r2_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_files_r2_key` ON `files` (`r2_key`);

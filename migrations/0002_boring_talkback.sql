PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_config` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_config`("user_id", "key", "value") SELECT "user_id", "key", "value" FROM `config`;--> statement-breakpoint
DROP TABLE `config`;--> statement-breakpoint
ALTER TABLE `__new_config` RENAME TO `config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_roles_user_role` ON `user_roles` (`user_id`,`role_id`);
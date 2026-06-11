CREATE TABLE `ai_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ai_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_id` integer NOT NULL,
	`model_id` text NOT NULL,
	`display_name` text NOT NULL,
	`context_window` integer,
	`max_output_tokens` integer,
	`input_cost_per_million` real,
	`output_cost_per_million` real,
	`enabled` integer DEFAULT true NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_models_provider_id` ON `ai_models` (`provider_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ai_models_provider_model` ON `ai_models` (`provider_id`,`model_id`);
--> statement-breakpoint
INSERT INTO `ai_providers` (`name`, `base_url`, `api_key`, `enabled`)
SELECT
	'Default',
	(SELECT value FROM config WHERE key = 'ai_base_url'),
	(SELECT value FROM config WHERE key = 'ai_api_key'),
	1
WHERE EXISTS (
	SELECT 1 FROM config WHERE key = 'ai_base_url' AND trim(value) != ''
)
AND EXISTS (
	SELECT 1 FROM config WHERE key = 'ai_api_key' AND trim(value) != ''
)
AND NOT EXISTS (SELECT 1 FROM ai_providers);
--> statement-breakpoint
INSERT INTO `ai_models` (
	`provider_id`,
	`model_id`,
	`display_name`,
	`context_window`,
	`input_cost_per_million`,
	`output_cost_per_million`,
	`enabled`
)
SELECT
	p.id,
	COALESCE((SELECT value FROM config WHERE key = 'ai_model'), 'openai/gpt-4o-mini'),
	COALESCE((SELECT value FROM config WHERE key = 'ai_model'), 'openai/gpt-4o-mini'),
	128000,
	0,
	0,
	1
FROM `ai_providers` p
WHERE p.name = 'Default'
AND NOT EXISTS (SELECT 1 FROM ai_models);
--> statement-breakpoint
INSERT OR REPLACE INTO `config` (`key`, `value`)
SELECT 'ai_default_model_id', CAST(m.id AS TEXT)
FROM `ai_models` m
INNER JOIN `ai_providers` p ON m.provider_id = p.id
WHERE p.name = 'Default'
AND NOT EXISTS (
	SELECT 1 FROM config WHERE key = 'ai_default_model_id' AND trim(value) != ''
)
LIMIT 1;

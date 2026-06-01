PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_memory_profile` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `r2_key` text NOT NULL,
  `search_text` text NOT NULL DEFAULT '',
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO `__new_memory_profile` (`id`, `r2_key`, `search_text`, `updated_at`)
SELECT
  `id`,
  'memory/profile.md' AS `r2_key`,
  SUBSTR(TRIM(REPLACE(REPLACE(COALESCE(`content`, ''), CHAR(10), ' '), CHAR(13), ' ')), 1, 4000) AS `search_text`,
  `updated_at`
FROM `memory_profile`;
DROP TABLE `memory_profile`;
ALTER TABLE `__new_memory_profile` RENAME TO `memory_profile`;
CREATE UNIQUE INDEX `uq_memory_profile_r2_key` ON `memory_profile` (`r2_key`);

CREATE TABLE `__new_memory_sessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_date` text NOT NULL,
  `topic` text NOT NULL,
  `exam_name` text NOT NULL,
  `total_questions` integer NOT NULL,
  `correct_answers` integer NOT NULL,
  `accuracy` integer NOT NULL,
  `duration` integer,
  `r2_key` text NOT NULL,
  `search_text` text NOT NULL DEFAULT '',
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO `__new_memory_sessions` (
  `id`, `session_date`, `topic`, `exam_name`, `total_questions`, `correct_answers`,
  `accuracy`, `duration`, `r2_key`, `search_text`, `created_at`
)
SELECT
  `id`,
  `session_date`,
  `topic`,
  `exam_name`,
  `total_questions`,
  `correct_answers`,
  `accuracy`,
  `duration`,
  'memory/sessions/legacy-' || `id` || '.md' AS `r2_key`,
  SUBSTR(TRIM(REPLACE(REPLACE(COALESCE(`content`, ''), CHAR(10), ' '), CHAR(13), ' ')), 1, 4000) AS `search_text`,
  `created_at`
FROM `memory_sessions`;
DROP TABLE `memory_sessions`;
ALTER TABLE `__new_memory_sessions` RENAME TO `memory_sessions`;
CREATE INDEX `idx_memory_sessions_topic` ON `memory_sessions` (`topic`);

CREATE TABLE `__new_memory_topic_notes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `topic_slug` text NOT NULL,
  `topic` text NOT NULL,
  `r2_key` text NOT NULL,
  `search_text` text NOT NULL DEFAULT '',
  `updated_at` text DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO `__new_memory_topic_notes` (`id`, `topic_slug`, `topic`, `r2_key`, `search_text`, `updated_at`)
SELECT
  `id`,
  `topic_slug`,
  `topic`,
  'memory/topics/' || `topic_slug` || '.md' AS `r2_key`,
  SUBSTR(TRIM(REPLACE(REPLACE(COALESCE(`content`, ''), CHAR(10), ' '), CHAR(13), ' ')), 1, 4000) AS `search_text`,
  `updated_at`
FROM `memory_topic_notes`;
DROP TABLE `memory_topic_notes`;
ALTER TABLE `__new_memory_topic_notes` RENAME TO `memory_topic_notes`;
CREATE UNIQUE INDEX `memory_topic_notes_topic_slug_unique` ON `memory_topic_notes` (`topic_slug`);
CREATE UNIQUE INDEX `uq_memory_topic_notes_r2_key` ON `memory_topic_notes` (`r2_key`);
CREATE INDEX `idx_memory_topic_notes_topic` ON `memory_topic_notes` (`topic`);

CREATE TABLE `__new_memory_documents` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `doc_type` text NOT NULL,
  `name` text NOT NULL,
  `topic` text,
  `r2_key` text NOT NULL,
  `search_text` text NOT NULL DEFAULT '',
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO `__new_memory_documents` (`id`, `doc_type`, `name`, `topic`, `r2_key`, `search_text`, `created_at`)
SELECT
  `id`,
  `doc_type`,
  `name`,
  `topic`,
  CASE
    WHEN INSTR(`name`, '/') > 0 THEN `name`
    ELSE 'memory/documents/' || `name`
  END AS `r2_key`,
  SUBSTR(TRIM(REPLACE(REPLACE(COALESCE(`content`, ''), CHAR(10), ' '), CHAR(13), ' ')), 1, 4000) AS `search_text`,
  `created_at`
FROM `memory_documents`;
DROP TABLE `memory_documents`;
ALTER TABLE `__new_memory_documents` RENAME TO `memory_documents`;
CREATE UNIQUE INDEX `uq_memory_documents_r2_key` ON `memory_documents` (`r2_key`);
CREATE INDEX `idx_memory_documents_type` ON `memory_documents` (`doc_type`);

PRAGMA foreign_keys=ON;

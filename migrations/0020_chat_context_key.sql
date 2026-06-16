ALTER TABLE `chat_conversations` ADD COLUMN `context_key` text;
CREATE INDEX `idx_chat_conversations_context_key` ON `chat_conversations` (`context_key`);

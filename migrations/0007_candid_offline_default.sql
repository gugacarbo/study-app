UPDATE `ai_models`
SET `health_status` = 'offline'
WHERE `health_status` IS NULL;

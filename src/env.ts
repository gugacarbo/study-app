import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		OPENROUTER_API_KEY: z.string().min(1),
		AI_PROVIDER: z.string().default("openrouter"),
		AI_MODEL: z.string().default("openai/gpt-4o-mini"),
		AI_LOG_LLM: z.enum(["true", "false"]).default("false"),
		AI_LOG_LLM_CONTENT: z.enum(["true", "false"]).default("true"),
		AI_LOG_LLM_CHUNKS: z.enum(["true", "false"]).default("false"),
	},
	clientPrefix: "VITE_",
	client: {},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
	skipValidation: process.env.NODE_ENV === "test",
});

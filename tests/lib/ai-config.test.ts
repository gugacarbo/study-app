import { describe, expect, it, vi } from "vitest";
import { loadAiSettings, resolveModelConfig } from "#/lib/ai-config";
import { agentModelConfigKey } from "#/lib/validation";
import { encryptSecret } from "#/lib/config-encryption";

describe("agentModelConfigKey", () => {
	it("builds per-agent config keys", () => {
		expect(agentModelConfigKey("chat")).toBe("agent.chat.model_id");
		expect(agentModelConfigKey("ingest")).toBe("agent.ingest.model_id");
	});
});

describe("resolveModelConfig", () => {
	it("prefers agent override over default model", async () => {
		const encryptedKey = await encryptSecret("sk-test");
		const queries = {
			getAllConfig: vi.fn().mockResolvedValue({
				ai_default_model_id: "1",
				"agent.chat.model_id": "2",
			}),
			getResolvedAiModelById: vi.fn(async (id: number) => {
				if (id === 1) {
					return {
						id: 1,
						providerId: 10,
						providerName: "Default",
						modelId: "default-model",
						displayName: "Default model",
						contextWindow: 128000,
						maxOutputTokens: null,
						inputCostPerMillion: 0,
						outputCostPerMillion: 0,
						enabled: true,
						metadata: null,
						providerBaseUrl: "https://openrouter.ai/api/v1",
						providerApiKey: encryptedKey,
					};
				}
				return {
					id: 2,
					providerId: 10,
					providerName: "Default",
					modelId: "chat-model",
					displayName: "Chat model",
					contextWindow: 128000,
					maxOutputTokens: null,
					inputCostPerMillion: 0,
					outputCostPerMillion: 0,
					enabled: true,
					metadata: null,
					providerBaseUrl: "https://openrouter.ai/api/v1",
					providerApiKey: encryptedKey,
				};
			}),
			listAiProviders: vi.fn().mockResolvedValue([]),
			listEnabledAiModels: vi.fn().mockResolvedValue([]),
		};

		const resolved = await resolveModelConfig(queries as never, "chat");
		expect(resolved?.model).toBe("chat-model");
		expect(queries.getResolvedAiModelById).toHaveBeenCalledWith(2);
	});

	it("loads AI settings with nullable agent overrides", async () => {
		const queries = {
			getAllConfig: vi.fn().mockResolvedValue({
				ai_default_model_id: "3",
				"agent.chat.model_id": "4",
			}),
		};

		const settings = await loadAiSettings(queries as never);
		expect(settings.defaultModelId).toBe(3);
		expect(settings.agentModels.chat).toBe(4);
		expect(settings.agentModels.quiz).toBeNull();
	});
});

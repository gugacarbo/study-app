import { chat } from "@tanstack/ai";
import { createOpenaiChatCompletions } from "@tanstack/ai-openai";
import type { ProviderConfig } from "../validation";
import { parseJsonFromModelText } from "./parse-json";

export function getAiAdapter(config: ProviderConfig) {
  const baseURL =
    config.baseUrl ||
    (config.provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : undefined);

  return createOpenaiChatCompletions(config.model as any, config.apiKey, {
    baseURL,
  });
}

export async function generateText(
  config: ProviderConfig,
  prompt: string,
  options?: { json?: boolean; system?: string },
) {
  const adapter = getAiAdapter(config);

  const result = await chat({
    adapter,
    messages: [{ role: "user", content: prompt }],
    systemPrompts: options?.system ? [options.system] : undefined,
    stream: false,
  });

  return { text: result };
}

export async function generateJson<T>(
  config: ProviderConfig,
  prompt: string,
  options?: { system?: string },
): Promise<T> {
  const result = await generateText(config, prompt, {
    json: true,
    system: options?.system,
  });

  return parseJsonFromModelText(result.text) as T;
}

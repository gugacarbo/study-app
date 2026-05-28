import type {
  SchemaInput,
  StreamChunk,
  StructuredOutputCompleteEvent,
} from "@tanstack/ai";
import { chat } from "@tanstack/ai";
import { createOpenaiChatCompletions } from "@tanstack/ai-openai";
import type { ProviderConfig } from "../validation";

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
  options?: { system?: string },
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
  outputSchema: SchemaInput,
  options?: { system?: string },
): Promise<T> {
  const adapter = getAiAdapter(config);

  const result = await chat({
    adapter,
    messages: [{ role: "user", content: prompt }],
    systemPrompts: options?.system ? [options.system] : undefined,
    stream: false,
    outputSchema,
  });

  return result as T;
}

function isStructuredOutputCompleteEvent<T>(
  chunk: StreamChunk | StructuredOutputCompleteEvent<T>,
): chunk is StructuredOutputCompleteEvent<T> {
  return chunk.type === "CUSTOM" && chunk.name === "structured-output.complete";
}

export async function generateJsonStream<T>(
  config: ProviderConfig,
  prompt: string,
  outputSchema: SchemaInput,
  options?: {
    system?: string;
    onChunk?: (chunk: StreamChunk | StructuredOutputCompleteEvent<T>) => void;
  },
): Promise<T> {
  const adapter = getAiAdapter(config);

  const stream = chat({
    adapter,
    messages: [{ role: "user", content: prompt }],
    systemPrompts: options?.system ? [options.system] : undefined,
    stream: true,
    outputSchema,
  });

  for await (const chunk of stream) {
    options?.onChunk?.(chunk);

    if (isStructuredOutputCompleteEvent<T>(chunk)) {
      return chunk.value.object;
    }
  }

  throw new Error("Structured output stream ended without completion event");
}

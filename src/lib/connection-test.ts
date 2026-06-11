import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import {
	createAiStreamState,
	isAiStreamRunErrorChunk,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import { loggedStreamText } from "@/features/ai/core/logged-stream-text";
import { createLlmLogContext } from "@/lib/llm-logging";
import type { ProviderConfig } from "@/lib/validation";

export type ConnectionProgressEvent = {
	progress: number;
	step: string;
};

export type ConnectionResultEvent = {
	response: string;
};

export async function runConnectionTestWithProgress(
	config: ProviderConfig,
	onProgress: (event: ConnectionProgressEvent) => void,
	onPrompt: (prompt: string) => void,
	onChunk: (chunk: string) => void,
	abortSignal: AbortSignal,
): Promise<ConnectionResultEvent> {
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Connection test canceled");
		}
	};

	onProgress({ progress: 10, step: "Validating configuration..." });
	assertNotAborted();

	onProgress({ progress: 25, step: "Preparing AI model..." });
	assertNotAborted();

	const system = "You are a connection test assistant. Respond concisely.";
	const userMsg =
		'Say: "Connection successful using model: <model-name>" and include only one short line.';
	onPrompt(`[System]\n${system}\n\n[User]\n${userMsg}`);

	onProgress({ progress: 40, step: "Connecting to provider..." });

	const streamState = createAiStreamState();
	let response = "";

	const result = loggedStreamText(
		createLlmLogContext("connection-test", config, {
			systemPrompt: system,
			requestSummary: userMsg,
		}),
		{
			model: getAiModel(config),
			system,
			messages: [{ role: "user", content: userMsg }],
			providerOptions: buildProviderOptions(config),
			abortSignal,
		},
	);

	onProgress({ progress: 55, step: "Streaming model response..." });

	for await (const chunk of result.fullStream) {
		assertNotAborted();
		if (isAiStreamRunErrorChunk(chunk)) {
			const message =
				chunk.error instanceof Error
					? chunk.error.message
					: String(chunk.error);
			throw new Error(`AI provider returned error: ${message}`);
		}

		processAiStreamPart(
			chunk,
			{
				onTextDelta: (delta) => {
					response += delta;
					onChunk(delta);
				},
			},
			streamState,
		);
	}

	onProgress({ progress: 100, step: "Completed" });
	return { response: response.trim() };
}

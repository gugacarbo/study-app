import {
	generateText,
	type GenerateTextResult,
	type LanguageModelUsage,
	type TextStreamPart,
	type ToolSet,
} from "ai";
import {
	logSyncGenerationError,
	logSyncGenerationResult,
	type LlmLogContext,
} from "@/lib/llm-logging";
import { loggedStreamText } from "./logged-stream-text";

type StreamTextOptions = NonNullable<Parameters<typeof import("ai").streamText>[0]>;
type GenerateTextOptions = NonNullable<Parameters<typeof generateText>[0]>;

export interface StreamTextCompatResult<TOOLS extends ToolSet> {
	text: string;
	usage?: LanguageModelUsage;
	usedGenerateTextFallback: boolean;
	fallbackResult?: GenerateTextResult<TOOLS, any>;
}

function readStreamErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

export function isMissingTextPartCompatibilityError(error: unknown): boolean {
	const message = readStreamErrorMessage(error);
	return /(?:^|:\s)text part [^ ]+ not found$/i.test(message);
}

export async function streamTextWithCompatibilityFallback<
	TOOLS extends ToolSet = ToolSet,
>({
	ctx,
	request,
	onStreamPart,
}: {
	ctx: LlmLogContext;
	request: StreamTextOptions & GenerateTextOptions;
	onStreamPart: (chunk: TextStreamPart<TOOLS>) => void;
}): Promise<StreamTextCompatResult<TOOLS>> {
	const result = loggedStreamText(ctx, request);

	try {
		for await (const chunk of result.fullStream as AsyncIterable<
			TextStreamPart<TOOLS>
		>) {
			if (chunk.type === "error") {
				throw new Error(
					`AI provider returned error: ${readStreamErrorMessage(chunk.error)}`,
				);
			}
			onStreamPart(chunk);
		}

		return {
			text: (await result.text).trim(),
			usage: await result.usage,
			usedGenerateTextFallback: false,
		};
	} catch (streamError) {
		if (!isMissingTextPartCompatibilityError(streamError)) {
			throw streamError;
		}

		const startedAt = Date.now();
		const requestPayload = {
			system: request.system,
			prompt: request.prompt,
			messages: request.messages,
		};

		try {
			const fallbackResult = (await generateText(request)) as unknown as GenerateTextResult<
				TOOLS,
				any
			>;

			logSyncGenerationResult(
				ctx,
				{
					text: fallbackResult.text,
					usage: fallbackResult.totalUsage,
					finishReason: fallbackResult.finishReason,
					steps: fallbackResult.steps,
				},
				startedAt,
				requestPayload,
			);

			return {
				text: fallbackResult.text.trim(),
				usage: fallbackResult.totalUsage,
				usedGenerateTextFallback: true,
				fallbackResult,
			};
		} catch (fallbackError) {
			logSyncGenerationError(ctx, fallbackError, startedAt, requestPayload);
			throw fallbackError;
		}
	}
}

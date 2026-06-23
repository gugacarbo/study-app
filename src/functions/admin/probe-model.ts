import { generateText } from "ai";
import type { AppDatabase } from "@/db/client";
import type { ModelProbeResult } from "@/features/admin/types/model-probe";
import {
	buildProbeProviderOptions,
	formatProbeError,
	PROBE_DEFAULT_TIMEOUT_MS,
	PROBE_MAX_OUTPUT_TOKENS,
	PROBE_PROMPT,
	resolveProbeModel,
} from "@/functions/admin/probe-model-core";

export {
	buildProbeRequest,
	formatProbeError,
	PROBE_MAX_OUTPUT_TOKENS,
	PROBE_PROMPT,
	resolveProbeModel,
} from "@/functions/admin/probe-model-core";

export async function probeModel(
	db: AppDatabase,
	userId: string,
	input: {
		id: string;
		modelId?: string;
		timeoutMs?: number;
		prompt?: string;
		reasoningEffort?: string | null;
	},
): Promise<ModelProbeResult> {
	const resolved = await resolveProbeModel(db, userId, input);
	if (!resolved.ok) {
		return resolved.result;
	}

	const { request, model } = resolved.probe;
	const timeoutMs = input.timeoutMs ?? PROBE_DEFAULT_TIMEOUT_MS;
	const timeoutController = new AbortController();
	let timedOut = false;
	const timeoutId = setTimeout(() => {
		timedOut = true;
		timeoutController.abort();
	}, timeoutMs);

	try {
		const result = await generateText({
			model,
			prompt: request.prompt || PROBE_PROMPT,
			maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
			abortSignal: timeoutController.signal,
			providerOptions: buildProbeProviderOptions(request.reasoningEffort),
		});

		return {
			ok: true,
			request,
			response: {
				ok: true,
				text: result.text,
				usage: result.usage
					? {
							inputTokens: result.usage.inputTokens,
							outputTokens: result.usage.outputTokens,
							totalTokens: result.usage.totalTokens,
						}
					: undefined,
				finishReason: result.finishReason,
			},
		};
	} catch (error) {
		return {
			ok: false,
			request,
			response: timedOut
				? { ok: false, error: `Timeout após ${Math.ceil(timeoutMs / 1000)}s` }
				: formatProbeError(error),
		};
	} finally {
		clearTimeout(timeoutId);
	}
}

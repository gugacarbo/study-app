import { generateText } from "ai";
import type { AppDatabase } from "@/db/client";
import type { ModelProbeResult } from "@/features/admin/types/model-probe";
import {
	formatProbeError,
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
	input: { id: string; modelId?: string },
): Promise<ModelProbeResult> {
	const resolved = await resolveProbeModel(db, userId, input);
	if (!resolved.ok) {
		return resolved.result;
	}

	const { request, model } = resolved.probe;

	try {
		const result = await generateText({
			model,
			prompt: PROBE_PROMPT,
			maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
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
			response: formatProbeError(error),
		};
	}
}

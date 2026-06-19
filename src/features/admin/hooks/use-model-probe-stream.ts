import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelProbeResult } from "@/features/admin/types/model-probe";
import { PROBE_PROMPT } from "@/functions/admin/probe-model-core";

export type ModelProbeStreamStatus = "idle" | "streaming" | "done" | "error";

export type ModelProbeStreamState = {
	status: ModelProbeStreamStatus;
	assistantText: string;
	result: ModelProbeResult | null;
};

const INITIAL_STATE: ModelProbeStreamState = {
	status: "idle",
	assistantText: "",
	result: null,
};

type StartProbeInput = {
	modelRowId: string;
	savedModelId: string;
	testedModelId: string;
	displayName: string;
	providerName: string;
	providerBaseUrl: string;
	maxOutputTokens: number;
};

function buildRequest(input: StartProbeInput): ModelProbeResult["request"] {
	return {
		modelRowId: input.modelRowId,
		savedModelId: input.savedModelId,
		testedModelId: input.testedModelId,
		displayName: input.displayName,
		providerName: input.providerName,
		providerBaseUrl: input.providerBaseUrl,
		prompt: PROBE_PROMPT,
		maxOutputTokens: input.maxOutputTokens,
	};
}

async function readErrorResult(response: Response): Promise<ModelProbeResult> {
	try {
		return (await response.json()) as ModelProbeResult;
	} catch {
		return {
			ok: false,
			request: {
				modelRowId: "",
				savedModelId: "",
				testedModelId: "",
				displayName: "",
				providerName: "",
				providerBaseUrl: "",
				prompt: PROBE_PROMPT,
				maxOutputTokens: 0,
			},
			response: {
				ok: false,
				error: `HTTP ${response.status}`,
				statusCode: response.status,
			},
		};
	}
}

export function useModelProbeStream() {
	const abortRef = useRef<AbortController | null>(null);
	const [state, setState] = useState<ModelProbeStreamState>(INITIAL_STATE);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setState(INITIAL_STATE);
	}, []);

	const start = useCallback(async (input: StartProbeInput) => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		const request = buildRequest(input);
		setState({
			status: "streaming",
			assistantText: "",
			result: null,
		});

		try {
			const response = await fetch(
				`/api/admin/models/${input.modelRowId}/test-stream`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ modelId: input.testedModelId }),
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				const errorResult = await readErrorResult(response);
				setState({
					status: "error",
					assistantText: "",
					result: {
						...errorResult,
						request: errorResult.request.modelRowId
							? errorResult.request
							: request,
					},
				});
				return;
			}

			if (!response.body) {
				setState({
					status: "error",
					assistantText: "",
					result: {
						ok: false,
						request,
						response: { ok: false, error: "Resposta sem corpo" },
					},
				});
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let assistantText = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				assistantText += decoder.decode(value, { stream: true });
				setState({
					status: "streaming",
					assistantText,
					result: null,
				});
			}

			assistantText += decoder.decode();
			const trimmed = assistantText.trim();
			setState({
				status: "done",
				assistantText,
				result: {
					ok: trimmed.length > 0,
					request,
					response: {
						ok: trimmed.length > 0,
						text: assistantText,
						error:
							trimmed.length > 0 ? undefined : "O modelo não retornou texto",
					},
				},
			});
		} catch (error) {
			if (controller.signal.aborted) return;
			setState({
				status: "error",
				assistantText: "",
				result: {
					ok: false,
					request,
					response: {
						ok: false,
						error:
							error instanceof Error ? error.message : "Falha ao testar modelo",
					},
				},
			});
		}
	}, []);

	useEffect(() => () => abortRef.current?.abort(), []);

	return { state, start, reset };
}

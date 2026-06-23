import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelProbeResult } from "@/features/admin/types/model-probe";
import { PROBE_PROMPT } from "@/functions/admin/probe-model-core";

export type ModelProbeStreamStatus = "idle" | "streaming" | "done" | "error";

export type ModelProbeMetrics = {
	startedAt: number | null;
	firstTokenAt: number | null;
	completedAt: number | null;
	totalDurationMs: number | null;
	timeToFirstTokenMs: number | null;
	outputTokensPerSecond: number | null;
};

export type ModelProbeStreamState = {
	status: ModelProbeStreamStatus;
	assistantText: string;
	result: ModelProbeResult | null;
	metrics: ModelProbeMetrics;
};

const INITIAL_METRICS: ModelProbeMetrics = {
	startedAt: null,
	firstTokenAt: null,
	completedAt: null,
	totalDurationMs: null,
	timeToFirstTokenMs: null,
	outputTokensPerSecond: null,
};

const INITIAL_STATE: ModelProbeStreamState = {
	status: "idle",
	assistantText: "",
	result: null,
	metrics: INITIAL_METRICS,
};

type StartProbeInput = {
	modelRowId: string;
	savedModelId: string;
	testedModelId: string;
	displayName: string;
	providerName: string;
	providerBaseUrl: string;
	maxOutputTokens: number;
	timeoutMs: number;
	prompt: string;
	reasoningEffort?: string | null;
};

function buildRequest(input: StartProbeInput): ModelProbeResult["request"] {
	return {
		modelRowId: input.modelRowId,
		savedModelId: input.savedModelId,
		testedModelId: input.testedModelId,
		displayName: input.displayName,
		providerName: input.providerName,
		providerBaseUrl: input.providerBaseUrl,
		prompt: input.prompt,
		maxOutputTokens: input.maxOutputTokens,
		timeoutMs: input.timeoutMs,
		reasoningEffort: input.reasoningEffort ?? null,
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
				timeoutMs: 0,
				reasoningEffort: null,
			},
			response: {
				ok: false,
				error: `HTTP ${response.status}`,
				statusCode: response.status,
			},
		};
	}
}

type StreamEvent =
	| { type: "http"; http: NonNullable<ModelProbeResult["http"]> }
	| { type: "delta"; text: string }
	| { type: "done"; result: ModelProbeResult }
	| { type: "error"; error?: string; result?: ModelProbeResult };

function parseEvent(line: string): StreamEvent | null {
	const trimmed = line.trim();
	if (!trimmed.startsWith("data:")) return null;
	const payload = trimmed.slice(5).trim();
	if (!payload) return null;
	try {
		return JSON.parse(payload) as StreamEvent;
	} catch {
		return null;
	}
}

function buildMetrics(
	startedAt: number,
	firstTokenAt: number | null,
	completedAt: number | null,
	outputTokens?: number,
): ModelProbeMetrics {
	const totalDurationMs =
		completedAt == null ? null : Math.max(0, completedAt - startedAt);
	const timeToFirstTokenMs =
		firstTokenAt == null ? null : Math.max(0, firstTokenAt - startedAt);
	const generationDurationMs =
		completedAt != null && firstTokenAt != null
			? Math.max(0, completedAt - firstTokenAt)
			: null;

	return {
		startedAt,
		firstTokenAt,
		completedAt,
		totalDurationMs,
		timeToFirstTokenMs,
		outputTokensPerSecond:
			outputTokens != null &&
			generationDurationMs != null &&
			generationDurationMs > 0
				? outputTokens / (generationDurationMs / 1000)
				: null,
	};
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
		const startedAt = performance.now();
		let firstTokenAt: number | null = null;
		setState({
			status: "streaming",
			assistantText: "",
			result: null,
			metrics: {
				...INITIAL_METRICS,
				startedAt,
			},
		});

		try {
			const response = await fetch(
				`/api/admin/models/${input.modelRowId}/test-stream`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({
						modelId: input.testedModelId,
						timeoutMs: input.timeoutMs,
						prompt: input.prompt,
						reasoningEffort: input.reasoningEffort ?? null,
					}),
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
					metrics: buildMetrics(startedAt, firstTokenAt, performance.now()),
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
					metrics: buildMetrics(startedAt, firstTokenAt, performance.now()),
				});
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let assistantText = "";
			let pendingHttp: NonNullable<ModelProbeResult["http"]> | null = null;
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					const event = parseEvent(line);
					if (!event) continue;

					switch (event.type) {
						case "http":
							pendingHttp = event.http;
							break;
						case "delta":
							assistantText += event.text;
							if (firstTokenAt == null) {
								firstTokenAt = performance.now();
							}
							setState({
								status: "streaming",
								assistantText,
								result: null,
								metrics: buildMetrics(startedAt, firstTokenAt, null),
							});
							break;
						case "done": {
							const completedAt = performance.now();
							const result: ModelProbeResult = {
								...event.result,
								http: pendingHttp ?? event.result.http,
							};
							setState({
								status: "done",
								assistantText: result.response.text ?? assistantText,
								result,
								metrics: buildMetrics(
									startedAt,
									firstTokenAt,
									completedAt,
									result.response.usage?.outputTokens,
								),
							});
							return;
						}
						case "error":
							{
								const completedAt = performance.now();
								const result =
									event.result ??
									({
										ok: false,
										request,
										response: { ok: false, error: event.error ?? "Falha ao testar modelo" },
										http: pendingHttp ?? undefined,
									} satisfies ModelProbeResult);
							setState({
								status: "error",
								assistantText,
								result,
								metrics: buildMetrics(
									startedAt,
									firstTokenAt,
									completedAt,
								),
							});
							return;
							}
						default:
							break;
					}
				}
			}

			buffer += decoder.decode();
			const lastEvent = parseEvent(buffer);
			if (lastEvent?.type === "done") {
				const completedAt = performance.now();
				const result: ModelProbeResult = {
					...lastEvent.result,
					http: pendingHttp ?? lastEvent.result.http,
				};
				setState({
					status: "done",
					assistantText: result.response.text ?? assistantText,
					result,
					metrics: buildMetrics(
						startedAt,
						firstTokenAt,
						completedAt,
						result.response.usage?.outputTokens,
					),
				});
				return;
			}

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
					http: pendingHttp ?? undefined,
				},
				metrics: buildMetrics(
					startedAt,
					firstTokenAt,
					performance.now(),
				),
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
				metrics: buildMetrics(startedAt, firstTokenAt, performance.now()),
			});
		}
	}, []);

	useEffect(() => () => abortRef.current?.abort(), []);

	return { state, start, reset };
}

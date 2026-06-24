import { streamText } from "ai";
import { createDb } from "@/db/client";
import { updateHealthStatus } from "@/db/queries/ai-models";
import type {
	ModelProbeHttp,
	ModelProbeResult,
} from "@/features/admin/types/model-probe";
import {
	buildProbeProviderOptions,
	formatProbeError,
	PROBE_DEFAULT_TIMEOUT_MS,
	PROBE_MAX_OUTPUT_TOKENS,
	PROBE_PROMPT,
	resolveProbeModel,
} from "@/functions/admin/probe-model-core";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";

const RESPONSE_BODY_MAX_LENGTH = 2000;

function truncateText(value: string, maxLength: number) {
	return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function headersToRecord(headers: Headers): Record<string, string> {
	const record: Record<string, string> = {};
	headers.forEach((value, key) => {
		record[key] = value;
	});
	return record;
}

function createHttpInterceptor() {
	let capturedRequest: ModelProbeHttp["request"] | undefined;
	let capturedResponse: ModelProbeHttp["response"] | undefined;

	const fetch: typeof globalThis.fetch = async (input, init) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const method = init?.method ?? "GET";

		let bodyText: string | undefined;
		if (init?.body != null) {
			if (typeof init.body === "string") {
				bodyText = init.body;
			} else if (init.body instanceof FormData) {
				bodyText = "[FormData]";
			} else if (init.body instanceof URLSearchParams) {
				bodyText = init.body.toString();
			} else if (init.body instanceof Blob) {
				bodyText = `[Blob ${init.body.type} ${init.body.size}b]`;
			} else if (ArrayBuffer.isView(init.body)) {
				bodyText = `[ArrayBuffer ${init.body.byteLength}b]`;
			} else if (init.body instanceof ReadableStream) {
				bodyText = "[ReadableStream]";
			}
		}

		capturedRequest = {
			method,
			url,
			headers: headersToRecord(new Headers(init?.headers)),
			body: bodyText,
		};

		const response = await globalThis.fetch(input, init);

		const cloned = response.clone();
		let responseBody: string | undefined;
		try {
			responseBody = truncateText(await cloned.text(), RESPONSE_BODY_MAX_LENGTH);
		} catch {
			responseBody = "[não legível]";
		}

		capturedResponse = {
			status: response.status,
			statusText: response.statusText,
			headers: headersToRecord(response.headers),
			body: responseBody,
		};

		return response;
	};

	return {
		fetch,
		getHttp: () => ({
			request: capturedRequest,
			response: capturedResponse,
		}),
	};
}

function probeErrorResponse(result: ModelProbeResult, status = 400): Response {
	return Response.json(result, { status });
}

function buildFinalResult(
	request: ModelProbeResult["request"],
	assistantText: string,
	http: ModelProbeHttp | undefined,
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	},
	finishReason?: string,
): ModelProbeResult {
	const trimmed = assistantText.trim();
	return {
		ok: trimmed.length > 0,
		request,
		response: {
			ok: trimmed.length > 0,
			text: assistantText,
			usage,
			finishReason,
			error:
				trimmed.length > 0 ? undefined : "O modelo não retornou texto",
		},
		http,
	};
}

type ProbeStreamEvent =
	| { type: "http"; http: ModelProbeHttp }
	| { type: "delta"; text: string }
	| { type: "done"; result: ModelProbeResult }
	| { type: "error"; result: ModelProbeResult };

function encodeEvent(event: ProbeStreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

export async function streamModelProbeHandler(
	modelRowId: string,
	request: Request,
	headers: Headers,
): Promise<Response> {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());

	let modelId: string | undefined;
	let timeoutMs = PROBE_DEFAULT_TIMEOUT_MS;
	let prompt = PROBE_PROMPT;
	let reasoningEffort: string | null | undefined;
	try {
		const body = (await request.json()) as {
			modelId?: string;
			timeoutMs?: number;
			prompt?: string;
			reasoningEffort?: string | null;
		};
		modelId = body.modelId?.trim() || undefined;
		timeoutMs =
			typeof body.timeoutMs === "number" && body.timeoutMs > 0
				? body.timeoutMs
				: PROBE_DEFAULT_TIMEOUT_MS;
		prompt = body.prompt?.trim() || PROBE_PROMPT;
		reasoningEffort = body.reasoningEffort?.trim() || null;
	} catch {
		modelId = undefined;
	}

	const resolved = await resolveProbeModel(db, session.user.id, {
		id: modelRowId,
		modelId,
		timeoutMs,
		prompt,
		reasoningEffort,
	});
	if (!resolved.ok) {
		const status =
			resolved.result.response.error === "Modelo não encontrado" ? 404 : 400;
		return probeErrorResponse(resolved.result, status);
	}

	const { fetch: interceptedFetch, getHttp } = createHttpInterceptor();
	const probeModel = await resolved.probe.withFetch(interceptedFetch);
	const timeoutController = new AbortController();
	let timedOut = false;
	const timeoutId = setTimeout(() => {
		timedOut = true;
		timeoutController.abort();
	}, timeoutMs);

	try {
		const result = streamText({
			model: probeModel,
			prompt: resolved.probe.request.prompt || PROBE_PROMPT,
			maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
			abortSignal: timeoutController.signal,
			providerOptions: buildProbeProviderOptions(
				resolved.probe.request.reasoningEffort,
			),
		});

		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				const http = getHttp();
				if (http.request) {
					controller.enqueue(
						encoder.encode(
							encodeEvent({
								type: "http",
								http: {
									request: http.request,
									response: http.response,
								},
							}),
						),
					);
				}

				let assistantText = "";
				try {
					for await (const chunk of result.textStream) {
						assistantText += chunk;
						controller.enqueue(
							encoder.encode(encodeEvent({ type: "delta", text: chunk })),
						);
					}

					const [usage, finishReason] = await Promise.all([
						result.usage,
						result.finishReason,
					]);

					const finalResult = buildFinalResult(
						resolved.probe.request,
						assistantText,
						getHttp(),
						usage,
						finishReason,
					);
					await updateHealthStatus(
						db,
						modelRowId,
						session.user.id,
						finalResult.ok ? "active" : "offline",
					);
					controller.enqueue(
						encoder.encode(
							encodeEvent({
								type: "done",
								result: finalResult,
							}),
						),
					);
				} catch (streamError) {
					await updateHealthStatus(db, modelRowId, session.user.id, "offline");
					controller.enqueue(
						encoder.encode(
							encodeEvent({
								type: "error",
								result: {
									ok: false,
									request: resolved.probe.request,
									response: timedOut
										? {
												ok: false,
												error: `Timeout após ${Math.ceil(timeoutMs / 1000)}s`,
											}
										: formatProbeError(streamError),
									http: getHttp(),
								},
							}),
						),
					);
				} finally {
					clearTimeout(timeoutId);
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		clearTimeout(timeoutId);
		return probeErrorResponse({
			ok: false,
			request: resolved.probe.request,
			response: timedOut
				? { ok: false, error: `Timeout após ${Math.ceil(timeoutMs / 1000)}s` }
				: formatProbeError(error),
			http: getHttp(),
		});
	}
}

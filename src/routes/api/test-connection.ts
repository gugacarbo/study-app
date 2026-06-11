import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { DBQueries } from "@/db/queries";
import { buildProviderOptions } from "@/features/ai/adapters/provider-options";
import { getAiModel } from "@/features/ai/adapters/provider-model";
import {
	createAiStreamState,
	isAiStreamRunErrorChunk,
	processAiStreamPart,
} from "@/features/ai/core/ai-stream-handler";
import {
	createAgentRunWriter,
	createJobUIMessageStream,
	createJobUIMessageStreamResponse,
	writeJobError,
	writeJobProgress,
	writeJobResult,
	type JobUIMessageStreamWriter,
} from "@/features/ai/core/ui-message-job-stream";
import { resolveModelConfigById } from "@/lib/ai-config";
import {
	testConnectionInputSchema,
	toProviderConfig,
	type ResolvedModelConfig,
} from "@/lib/validation";

const CONNECTION_TEST_STAGE_ID = "connection-test";

async function runConnectionTest(
	writer: JobUIMessageStreamWriter,
	modelConfig: ResolvedModelConfig,
	abortSignal: AbortSignal,
): Promise<void> {
	const assertNotAborted = () => {
		if (abortSignal.aborted) {
			throw new Error("Connection test canceled");
		}
	};

	let lastProgress = 0;
	const sendProgress = (percent: number, step: string) => {
		const bounded = Math.max(lastProgress, Math.min(100, percent));
		lastProgress = bounded;
		writeJobProgress(writer, {
			step,
			percent: bounded,
			stageId: CONNECTION_TEST_STAGE_ID,
		});
	};

	const agentRuns = createAgentRunWriter(writer);
	const run = agentRuns.createRun(CONNECTION_TEST_STAGE_ID, "Connection Test");

	sendProgress(10, "Validating configuration...");
	assertNotAborted();

	const providerConfig = toProviderConfig(modelConfig);

	sendProgress(25, "Preparing AI model...");
	assertNotAborted();

	const system = "You are a connection test assistant. Respond concisely.";
	const userMsg =
		'Say: "Connection successful using model: <model-name>" and include only one short line.';

	agentRuns.lifecycle(run, "pending", {
		systemPrompt: system,
		userPrompt: `[System]\n${system}\n\n[User]\n${userMsg}`,
	});
	agentRuns.lifecycle(run, "running");

	sendProgress(40, "Connecting to provider...");
	assertNotAborted();

	const streamState = createAiStreamState();
	let responseText = "";

	const result = streamText({
		model: getAiModel(providerConfig),
		system,
		messages: [{ role: "user", content: userMsg }],
		providerOptions: buildProviderOptions(providerConfig),
		abortSignal,
	});

	sendProgress(55, "Streaming model response...");

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
					responseText += delta;
					agentRuns.token(run, delta);
				},
			},
			streamState,
		);
	}

	const response = responseText.trim() || (await result.text).trim();

	agentRuns.lifecycle(run, "done");
	sendProgress(100, "Completed");
	writeJobResult(writer, { response });
}

export const Route = createFileRoute("/api/test-connection")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				const payload = await request.json().catch(() => null);
				const parsed = testConnectionInputSchema.safeParse(payload);
				if (!parsed.success) {
					return new Response("Invalid model selection", { status: 400 });
				}

				const { getDB } = await import("@/server-functions/db");
				const db = await getDB();
				if (!db) {
					return new Response("D1 database not available", { status: 500 });
				}

				const queries = new DBQueries(db);
				let modelConfig: ResolvedModelConfig;
				try {
					modelConfig = await resolveModelConfigById(
						queries,
						parsed.data.modelId,
					);
				} catch (error) {
					return new Response(
						error instanceof Error ? error.message : "AI model not configured",
						{ status: 400 },
					);
				}

				const stream = createJobUIMessageStream({
					execute: async ({ writer }) => {
						try {
							await runConnectionTest(
								writer,
								modelConfig,
								request.signal,
							);
						} catch (error) {
							writeJobError(writer, {
								message:
									error instanceof Error
										? error.message
										: "Unknown connection test error",
								stageId: CONNECTION_TEST_STAGE_ID,
							});
						}
					},
				});

				return createJobUIMessageStreamResponse(stream);
			},
		},
	},
} as never);

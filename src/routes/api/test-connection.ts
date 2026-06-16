import { createFileRoute } from "@tanstack/react-router";
import { DBQueries } from "@/db/queries";
import { writeJobResult } from "@/features/ai/core/ui-message-job-stream";
import { createAgentEventEmitter } from "@/features/ai/pipeline/server/agent-emitter";
import { createJobApiRoute } from "@/features/ai/pipeline/server/create-job-api-route";
import { JobProgressTracker } from "@/features/ai/pipeline/server/job-progress-tracker";
import { runPipelineTextAgent } from "@/features/ai/pipeline/server/run-pipeline-text-agent";
import { resolveModelConfigById } from "@/lib/ai-config";
import {
	type ResolvedModelConfig,
	testConnectionInputSchema,
	toProviderConfig,
} from "@/lib/validation";

const CONNECTION_TEST_STAGE_ID = "connection-test";

const connectionTestHandler = createJobApiRoute({
	schema: testConnectionInputSchema,
	logTag: "connection-test-handler",
	signal: true,
	run: async ({ writer, data, signal, agentRuns, ctx }) => {
		const { getDB } = await import("@/server-functions/db");
		const db = await getDB();
		if (!db) {
			throw new Error("D1 database not available");
		}

		const queries = new DBQueries(db);
		const modelConfig: ResolvedModelConfig = await resolveModelConfigById(
			queries,
			data.modelId,
		);

		ctx.stageId = CONNECTION_TEST_STAGE_ID;

		const progress = new JobProgressTracker(writer, {
			stageId: CONNECTION_TEST_STAGE_ID,
			signal,
			canceledMessage: "Connection test canceled",
		});

		progress.step(10, "Validating configuration...");

		const providerConfig = toProviderConfig(modelConfig);

		progress.step(25, "Preparing AI model...");

		const system = "You are a connection test assistant. Respond concisely.";
		const userMsg =
			'Say: "Connection successful using model: <model-name>" and include only one short line.';

		const run = agentRuns.createRun(
			CONNECTION_TEST_STAGE_ID,
			"Connection Test",
		);
		ctx.agentRunId = run.agentRunId;
		const emit = createAgentEventEmitter(agentRuns, run);

		progress.step(40, "Connecting to provider...");
		progress.step(55, "Streaming model response...");

		const result = await runPipelineTextAgent({
			scope: "connection-test",
			stageId: CONNECTION_TEST_STAGE_ID,
			config: providerConfig,
			run,
			emit,
			systemPrompt: system,
			userPrompt: userMsg,
			requestSummary: userMsg,
			abortSignal: signal,
			meta: { modelId: modelConfig.modelId },
		});

		if (!result.success) {
			throw new Error(result.reason ?? "Connection test failed");
		}

		progress.step(100, "Completed");
		writeJobResult(writer, {
			response: result.text,
			usage: result.usage,
			modelId: modelConfig.modelId,
			model: modelConfig.model,
			providerName: modelConfig.providerName,
		});
	},
});

export const Route = createFileRoute("/api/test-connection")({
	server: {
		handlers: {
			POST: connectionTestHandler,
		},
	},
} as never);

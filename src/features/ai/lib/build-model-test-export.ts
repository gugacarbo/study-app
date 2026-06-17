import type { UIMessage } from "ai";
import type { TestStatus } from "@/features/ai/components/config/use-connection-test";
import type { TokenTotals } from "@/features/ai/components/token-totals-badge";
import type {
	BenchmarkPhaseMetrics,
	StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import {
	estimateTokenCost,
	type TokenCostEstimate,
} from "@/features/ai/lib/token-usage";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import type { ModelTestMode } from "@/features/config/lib/model-test-process";

export type ModelTestExportJson = {
	version: 1;
	model: {
		id: number | null;
		label: string | null;
		inputCostPerMillion: number | null;
		outputCostPerMillion: number | null;
	};
	test: {
		mode: ModelTestMode;
		status: TestStatus;
		progress: number;
		step: string;
		error: string | null;
	};
	request: {
		endpoint: "/api/test-connection" | "/api/test-model-benchmark";
		method: "POST";
		body: { modelId: number } | null;
		systemPrompt: string | null;
		userPrompt: string | null;
	};
	response: {
		text: string | null;
		messages: UIMessage[];
		tokenTotals: TokenTotals | null;
		streamMetrics: StreamPerfMetrics | null;
		costEstimate: TokenCostEstimate | null;
		phases?: BenchmarkPhaseMetrics[];
		phaseSummary?: {
			total: number;
			passed: number;
			failed: number;
			pending: number;
		};
	};
	logs: PipelineLogEntry[];
};

export type BuildModelTestExportInput = {
	testMode: ModelTestMode;
	modelId?: number | null;
	modelLabel?: string;
	testStatus: TestStatus;
	testProgress: number;
	testStep: string;
	testError: string;
	tokenTotals: TokenTotals | null;
	streamMetrics?: StreamPerfMetrics | null;
	phaseMetrics?: BenchmarkPhaseMetrics[];
	messages: UIMessage[];
	logs?: PipelineLogEntry[];
	userPrompt?: string;
	responseText?: string;
	inputCostPerMillion?: number | null;
	outputCostPerMillion?: number | null;
};

function summarizePhases(phases: BenchmarkPhaseMetrics[]) {
	return {
		total: phases.length,
		passed: phases.filter((phase) => phase.passed === true).length,
		failed: phases.filter((phase) => phase.passed === false).length,
		pending: phases.filter((phase) => phase.passed == null).length,
	};
}

function messageText(message: UIMessage): string {
	return message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n")
		.trim();
}

function extractPrompts(
	messages: UIMessage[],
	fallbackUserPrompt?: string,
): { systemPrompt: string | null; userPrompt: string | null } {
	const systemMessage = messages.find((message) => message.role === "system");
	const userMessage = messages.find((message) => message.role === "user");
	const systemPrompt = systemMessage ? messageText(systemMessage) || null : null;
	const userPrompt =
		fallbackUserPrompt?.trim() ||
		(userMessage ? messageText(userMessage) || null : null);

	return { systemPrompt, userPrompt: userPrompt || null };
}

function resolveEndpoint(
	testMode: ModelTestMode,
): "/api/test-connection" | "/api/test-model-benchmark" {
	return testMode === "benchmark"
		? "/api/test-model-benchmark"
		: "/api/test-connection";
}

export function buildModelTestExport(
	input: BuildModelTestExportInput,
): ModelTestExportJson {
	const phases = input.phaseMetrics ?? [];
	const costEstimate = input.tokenTotals
		? estimateTokenCost(
				input.tokenTotals,
				input.inputCostPerMillion,
				input.outputCostPerMillion,
			)
		: null;
	const prompts = extractPrompts(input.messages, input.userPrompt);
	const modelId = input.modelId ?? null;

	return {
		version: 1,
		model: {
			id: modelId,
			label: input.modelLabel ?? null,
			inputCostPerMillion: input.inputCostPerMillion ?? null,
			outputCostPerMillion: input.outputCostPerMillion ?? null,
		},
		test: {
			mode: input.testMode,
			status: input.testStatus,
			progress: input.testProgress,
			step: input.testStep,
			error: input.testError.trim() ? input.testError : null,
		},
		request: {
			endpoint: resolveEndpoint(input.testMode),
			method: "POST",
			body: modelId != null ? { modelId } : null,
			systemPrompt: prompts.systemPrompt,
			userPrompt: prompts.userPrompt,
		},
		response: {
			text: input.responseText?.trim() ? input.responseText : null,
			messages: input.messages,
			tokenTotals: input.tokenTotals,
			streamMetrics: input.streamMetrics ?? null,
			costEstimate,
			...(input.testMode === "benchmark"
				? {
						phases,
						phaseSummary: summarizePhases(phases),
					}
				: {}),
		},
		logs: input.logs ?? [],
	};
}

export function serializeModelTestExport(
	input: BuildModelTestExportInput,
): string {
	return JSON.stringify(buildModelTestExport(input), null, 2);
}

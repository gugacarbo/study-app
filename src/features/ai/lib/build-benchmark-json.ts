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

export type BenchmarkExportJson = {
	version: 1;
	model: {
		label: string | null;
		inputCostPerMillion: number | null;
		outputCostPerMillion: number | null;
	};
	test: {
		mode: "benchmark";
		status: TestStatus;
		progress: number;
		step: string;
		error: string | null;
	};
	metrics: {
		stream: StreamPerfMetrics | null;
		tokens: TokenTotals | null;
		costEstimate: TokenCostEstimate | null;
		phases: BenchmarkPhaseMetrics[];
		phaseSummary: {
			total: number;
			passed: number;
			failed: number;
			pending: number;
		};
	};
	messages: UIMessage[];
};

export type BuildBenchmarkJsonInput = {
	modelLabel?: string;
	testStatus: TestStatus;
	testProgress: number;
	testStep: string;
	testError: string;
	tokenTotals: TokenTotals | null;
	streamMetrics?: StreamPerfMetrics | null;
	phases: BenchmarkPhaseMetrics[];
	messages: UIMessage[];
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

export function buildBenchmarkJson(
	input: BuildBenchmarkJsonInput,
): BenchmarkExportJson {
	const costEstimate = input.tokenTotals
		? estimateTokenCost(
				input.tokenTotals,
				input.inputCostPerMillion,
				input.outputCostPerMillion,
			)
		: null;

	return {
		version: 1,
		model: {
			label: input.modelLabel ?? null,
			inputCostPerMillion: input.inputCostPerMillion ?? null,
			outputCostPerMillion: input.outputCostPerMillion ?? null,
		},
		test: {
			mode: "benchmark",
			status: input.testStatus,
			progress: input.testProgress,
			step: input.testStep,
			error: input.testError.trim() ? input.testError : null,
		},
		metrics: {
			stream: input.streamMetrics ?? null,
			tokens: input.tokenTotals,
			costEstimate,
			phases: input.phases,
			phaseSummary: summarizePhases(input.phases),
		},
		messages: input.messages,
	};
}

export function serializeBenchmarkJson(input: BuildBenchmarkJsonInput): string {
	return JSON.stringify(buildBenchmarkJson(input), null, 2);
}

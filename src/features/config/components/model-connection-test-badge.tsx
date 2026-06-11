import { useStore } from "@tanstack/react-store";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	formatTokensPerSecond,
	formatTtft,
} from "@/features/ai/lib/stream-perf-metrics";
import {
	backgroundProcessStore,
	isConnectionTestProcess,
	isModelBenchmarkProcess,
} from "@/features/background-processes";
import { getModelTestProcessForModel } from "@/features/config/lib/model-test-process";
import { cn } from "@/lib/utils";

export type ModelConnectionTestBadgeStatus =
	| "untested"
	| "testing"
	| "success"
	| "failed";

const BADGE_LABEL: Record<ModelConnectionTestBadgeStatus, string> = {
	untested: "Untested",
	testing: "Testing",
	success: "Connected",
	failed: "Failed",
};

const BADGE_CLASS: Record<ModelConnectionTestBadgeStatus, string> = {
	untested: "border-border bg-muted text-muted-foreground",
	testing:
		"border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
	success:
		"border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
	failed:
		"border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

function resolveBadgeStatus(
	process: ReturnType<typeof getModelTestProcessForModel>,
): ModelConnectionTestBadgeStatus {
	if (!process) return "untested";

	if (
		process.process.status === "queued" ||
		process.process.status === "running"
	) {
		return "testing";
	}

	if (process.process.status === "success") {
		return "success";
	}

	if (
		process.process.status === "error" ||
		process.process.status === "canceled"
	) {
		return "failed";
	}

	return "untested";
}

function buildTooltip(
	selection: ReturnType<typeof getModelTestProcessForModel>,
	status: ModelConnectionTestBadgeStatus,
): string | null {
	if (!selection) return null;

	const { process, mode } = selection;
	if (!isConnectionTestProcess(process) && !isModelBenchmarkProcess(process)) {
		return null;
	}

	const isBenchmark = mode === "benchmark";

	if (status === "testing") {
		return `${process.step || (isBenchmark ? "Running benchmark..." : "Running connection test...")}\nClick to view progress.`;
	}

	if (status === "success") {
		const parts: string[] = [];

		if (isBenchmark && isModelBenchmarkProcess(process)) {
			const passedCount = process.phases.filter(
				(phase) => phase.passed === true,
			).length;
			parts.push(
				`Benchmark: ${passedCount}/${process.phases.length} phases passed.`,
			);
			for (const phase of process.phases) {
				const statusLabel = phase.passed ? "pass" : "fail";
				parts.push(`• ${phase.label}: ${statusLabel}`);
			}
		} else if (isConnectionTestProcess(process)) {
			parts.push(process.response.trim() || "Connection successful.");
		}

		if (process.streamMetrics?.ttftMs != null) {
			parts.push(`TTFT: ${formatTtft(process.streamMetrics.ttftMs)}`);
		}
		if (process.streamMetrics?.tokensPerSecond != null) {
			parts.push(
				`Throughput: ${formatTokensPerSecond(process.streamMetrics.tokensPerSecond)}`,
			);
		}
		if (process.streamMetrics?.totalRequestMs != null) {
			parts.push(
				`Total: ${formatTtft(process.streamMetrics.totalRequestMs)}`,
			);
		}
		if (process.tokenTotals) {
			parts.push(
				`Tokens: ${process.tokenTotals.total.toLocaleString()} (in ${process.tokenTotals.prompt.toLocaleString()} / out ${process.tokenTotals.completion.toLocaleString()})`,
			);
		}
		parts.push("Click to view details.");
		return parts.join("\n");
	}

	if (status === "failed") {
		return `${process.error || (isBenchmark ? "Benchmark failed." : "Connection test failed.")}\nClick to view details.`;
	}

	return null;
}

export function ModelConnectionTestBadge({
	modelId,
	onViewTest,
}: {
	modelId: number;
	onViewTest?: () => void;
}) {
	const { processes } = useStore(backgroundProcessStore);
	const selection = getModelTestProcessForModel(modelId, processes);
	const status = resolveBadgeStatus(selection);
	const tooltip = buildTooltip(selection, status);
	const label =
		selection?.mode === "benchmark" && status === "testing"
			? "Benchmarking"
			: BADGE_LABEL[status];
	const isClickable = status !== "untested" && onViewTest != null;

	const badge = (
		<Badge
			variant="outline"
			className={cn(
				"text-[0.625rem] font-medium",
				BADGE_CLASS[status],
				isClickable &&
					"cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			)}
			{...(isClickable
				? {
						role: "button" as const,
						tabIndex: 0,
						onClick: (event: React.MouseEvent) => {
							event.stopPropagation();
							onViewTest?.();
						},
						onKeyDown: (event: React.KeyboardEvent) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								event.stopPropagation();
								onViewTest?.();
							}
						},
					}
				: {})}
		>
			{status === "testing" ? (
				<span className="inline-flex items-center gap-1">
					<Loader2 className="size-3 animate-spin" />
					{label}
				</span>
			) : (
				label
			)}
		</Badge>
	);

	if (!tooltip) {
		return badge;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex">{badge}</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs whitespace-pre-wrap">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

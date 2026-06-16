import type { UIMessage } from "ai";
import {
	CheckCircle2Icon,
	CheckIcon,
	CopyIcon,
	Loader2Icon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import {
	type TokenTotals,
	TokenTotalsBadge,
} from "@/features/ai/components/token-totals-badge";
import { useReadOnlyAssistantRuntime } from "@/features/ai/hooks/use-readonly-assistant-runtime";
import {
	type BenchmarkPhaseMetrics,
	formatTokensPerSecond,
	formatTtft,
	type StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import {
	estimateTokenCost,
	formatUsdCost,
} from "@/features/ai/lib/token-usage";
import { serializeBenchmarkJson } from "@/features/ai/lib/build-benchmark-json";
import { filterBenchmarkMessagesByPhase } from "@/features/ai/lib/filter-benchmark-messages";
import type { ModelTestMode } from "@/features/config/lib/model-test-process";
import { cn } from "@/lib/utils";
import type { TestStatus } from "./use-connection-test";

type TestConnectionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	testMode?: ModelTestMode;
	testStatus: TestStatus;
	testProgress: number;
	testStep: string;
	testMessages: UIMessage[];
	tokenTotals: TokenTotals | null;
	streamMetrics?: StreamPerfMetrics | null;
	phaseMetrics?: BenchmarkPhaseMetrics[];
	testError: string;
	modelLabel?: string;
	inputCostPerMillion?: number | null;
	outputCostPerMillion?: number | null;
	onRetest?: () => void;
	showRetest?: boolean;
};

function ConnectionTestThread({
	messages,
	isStreaming,
}: {
	messages: UIMessage[];
	isStreaming: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const runtime = useReadOnlyAssistantRuntime({
		messages,
		isRunning: isStreaming,
	});
	const scrollKey = messages
		.flatMap((message) => message.parts)
		.map((part) => (part.type === "text" ? part.text.length : 0))
		.join(":");

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when streamed content grows
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [scrollKey, isStreaming]);

	if (messages.length === 0) {
		return (
			<div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
				{isStreaming ? (
					<span className="inline-flex items-center gap-2">
						<Loader2Icon className="size-4 animate-spin" />
						Waiting for model response...
					</span>
				) : (
					"Run a test to preview the provider conversation."
				)}
			</div>
		);
	}

	return (
		<div
			ref={scrollRef}
			className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3"
		>
			<StudyAssistantRuntimeProvider runtime={runtime}>
				<Thread showComposer={false} collapsiblePrompts />
			</StudyAssistantRuntimeProvider>
		</div>
	);
}

function StreamPerfBadges({
	streamMetrics,
	isStreaming,
}: {
	streamMetrics: StreamPerfMetrics | null | undefined;
	isStreaming: boolean;
}) {
	if (!streamMetrics) return null;

	const { ttftMs, tokensPerSecond, totalRequestMs } = streamMetrics;
	const showTtft = ttftMs != null;
	const showThroughput = tokensPerSecond != null;
	const showTotal = totalRequestMs != null;

	if (!showTtft && !showThroughput && !showTotal) {
		return null;
	}

	return (
		<>
			{showTtft ? (
				<Badge variant="outline" className="text-[0.625rem] font-normal">
					TTFT: {formatTtft(ttftMs)}
				</Badge>
			) : null}
			{showTotal ? (
				<Badge variant="outline" className="text-[0.625rem] font-normal">
					Total: {formatTtft(totalRequestMs)}
				</Badge>
			) : null}
			{showThroughput ? (
				<Badge variant="outline" className="text-[0.625rem] font-normal">
					{formatTokensPerSecond(tokensPerSecond)}
				</Badge>
			) : isStreaming ? (
				<Badge
					variant="outline"
					className="text-[0.625rem] font-normal text-muted-foreground"
				>
					Measuring throughput...
				</Badge>
			) : null}
		</>
	);
}

function formatMetricValue(value: number | null): string {
	if (value == null) return "—";
	if (value < 1000) return `${Math.round(value)}ms`;
	return `${(value / 1000).toFixed(1)}s`;
}

function PhaseMetricsTable({
	phases,
	selectedPhaseId = null,
	onPhaseSelect,
}: {
	phases: BenchmarkPhaseMetrics[];
	selectedPhaseId?: string | null;
	onPhaseSelect?: (phaseId: string) => void;
}) {
	if (phases.length === 0) return null;

	const isSelectable = onPhaseSelect != null;

	return (
		<div className="overflow-x-auto rounded-md border border-border">
			<table className="w-full min-w-[36rem] text-left text-xs">
				<thead className="border-b border-border bg-muted/40 text-muted-foreground">
					<tr>
						<th className="px-3 py-2 font-medium">Phase</th>
						<th className="px-3 py-2 font-medium">Status</th>
						<th className="px-3 py-2 font-medium">TTFT</th>
						<th className="px-3 py-2 font-medium">TTFT tool</th>
						<th className="px-3 py-2 font-medium">Tool RT</th>
						<th className="px-3 py-2 font-medium">Tok/s</th>
					</tr>
				</thead>
				<tbody>
					{phases.map((phase) => {
						const isSelected = selectedPhaseId === phase.phaseId;

						return (
							<tr
								key={phase.phaseId}
								className={cn(
									"border-b border-border/60",
									isSelectable &&
										"cursor-pointer transition-colors hover:bg-muted/50",
									isSelected && "bg-primary/10",
								)}
								onClick={
									isSelectable
										? () => onPhaseSelect(phase.phaseId)
										: undefined
								}
								onKeyDown={
									isSelectable
										? (event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													onPhaseSelect(phase.phaseId);
												}
											}
										: undefined
								}
								tabIndex={isSelectable ? 0 : undefined}
								aria-selected={isSelectable ? isSelected : undefined}
							>
								<td className="px-3 py-2 font-medium">{phase.label}</td>
								<td className="px-3 py-2">
									{phase.passed == null ? "…" : phase.passed ? "✓" : "✗"}
								</td>
								<td className="px-3 py-2 tabular-nums">
									{formatMetricValue(phase.ttftMs)}
								</td>
								<td className="px-3 py-2 tabular-nums">
									{formatMetricValue(phase.ttftToolMs)}
								</td>
								<td className="px-3 py-2 tabular-nums">
									{formatMetricValue(phase.toolRoundTripMs)}
								</td>
								<td className="px-3 py-2 tabular-nums">
									{phase.tokensPerSecond != null
										? formatTokensPerSecond(phase.tokensPerSecond)
										: "—"}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function BenchmarkChatSection({
	messages,
	phaseMetrics,
	selectedPhaseId,
	onPhaseSelect,
	isStreaming,
}: {
	messages: UIMessage[];
	phaseMetrics: BenchmarkPhaseMetrics[];
	selectedPhaseId: string | null;
	onPhaseSelect: (phaseId: string) => void;
	isStreaming: boolean;
}) {
	const filteredMessages = filterBenchmarkMessagesByPhase(
		messages,
		selectedPhaseId,
		phaseMetrics,
	);

	return (
		<>
			{phaseMetrics.length > 0 ? (
				<div className="shrink-0 space-y-1">
					<PhaseMetricsTable
						phases={phaseMetrics}
						selectedPhaseId={selectedPhaseId}
						onPhaseSelect={onPhaseSelect}
					/>
					{selectedPhaseId ? (
						<p className="text-[0.7rem] text-muted-foreground">
							Showing chat for{" "}
							{phaseMetrics.find((phase) => phase.phaseId === selectedPhaseId)
								?.label ?? "selected phase"}
							. Click the row again to show all phases.
						</p>
					) : null}
				</div>
			) : null}
			<ConnectionTestThread
				messages={filteredMessages}
				isStreaming={isStreaming}
			/>
		</>
	);
}

function BenchmarkFailureSummary({
	testError,
	testStep,
	phaseMetrics,
	className,
}: {
	testError: string;
	testStep: string;
	phaseMetrics: BenchmarkPhaseMetrics[];
	className?: string;
}) {
	const failedPhases = phaseMetrics.filter((phase) => phase.passed === false);
	const passedPhases = phaseMetrics.filter((phase) => phase.passed === true);
	const pendingPhases = phaseMetrics.filter((phase) => phase.passed == null);

	return (
		<div
			className={cn(
				"space-y-4 overflow-auto rounded-md border border-destructive/25 bg-destructive/10 p-4",
				className,
			)}
		>
			<div className="flex items-start gap-3">
				<XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
				<div className="space-y-1">
					<p className="font-medium text-foreground">
						Benchmark completed with failures
					</p>
					<p className="text-sm text-muted-foreground">
						{failedPhases.length > 0
							? `${failedPhases.length} of ${phaseMetrics.length} benchmark phases failed. Review the failed phases and the full trace below.`
							: "The benchmark returned an error before all phases could pass. Review the details and full trace below."}
					</p>
				</div>
			</div>

			<div className="grid gap-2 sm:grid-cols-3">
				<div className="rounded-md border border-border/70 bg-background/70 p-3">
					<p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
						Failed
					</p>
					<p className="mt-1 text-lg font-semibold text-destructive">
						{failedPhases.length}
					</p>
				</div>
				<div className="rounded-md border border-border/70 bg-background/70 p-3">
					<p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
						Passed
					</p>
					<p className="mt-1 text-lg font-semibold text-emerald-600">
						{passedPhases.length}
					</p>
				</div>
				<div className="rounded-md border border-border/70 bg-background/70 p-3">
					<p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
						Pending
					</p>
					<p className="mt-1 text-lg font-semibold text-foreground">
						{pendingPhases.length}
					</p>
				</div>
			</div>

			{testStep ? (
				<div className="rounded-md border border-border/70 bg-background/70 p-3 text-sm">
					<p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
						Last step
					</p>
					<p className="mt-1 text-foreground">{testStep}</p>
				</div>
			) : null}

			<div className="rounded-md border border-destructive/20 bg-background/80 p-3">
				<p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
					Error details
				</p>
				<pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-foreground">
					{testError}
				</pre>
			</div>

			{failedPhases.length > 0 ? (
				<div className="grid gap-2 lg:grid-cols-2">
					{failedPhases.map((phase) => (
						<div
							key={phase.phaseId}
							className="rounded-md border border-destructive/20 bg-background/80 p-3"
						>
							<div className="flex items-center justify-between gap-3">
								<p className="font-medium text-foreground">{phase.label}</p>
								<Badge
									variant="outline"
									className="border-destructive/30 bg-destructive/5 text-destructive"
								>
									Failed
								</Badge>
							</div>
							<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
								<div>
									<p>TTFT</p>
									<p className="mt-1 font-medium text-foreground">
										{formatMetricValue(phase.ttftMs)}
									</p>
								</div>
								<div>
									<p>TTFT tool</p>
									<p className="mt-1 font-medium text-foreground">
										{formatMetricValue(phase.ttftToolMs)}
									</p>
								</div>
								<div>
									<p>Tool RT</p>
									<p className="mt-1 font-medium text-foreground">
										{formatMetricValue(phase.toolRoundTripMs)}
									</p>
								</div>
								<div>
									<p>Throughput</p>
									<p className="mt-1 font-medium text-foreground">
										{phase.tokensPerSecond != null
											? formatTokensPerSecond(phase.tokensPerSecond)
											: "—"}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			) : null}

			{phaseMetrics.length > 0 ? (
				<PhaseMetricsTable phases={phaseMetrics} />
			) : null}
		</div>
	);
}

function CostBreakdown({
	tokenTotals,
	inputCostPerMillion,
	outputCostPerMillion,
}: {
	tokenTotals: TokenTotals;
	inputCostPerMillion?: number | null;
	outputCostPerMillion?: number | null;
}) {
	const estimate = estimateTokenCost(
		tokenTotals,
		inputCostPerMillion,
		outputCostPerMillion,
	);

	if (!estimate) {
		return null;
	}

	return (
		<Badge variant="outline" className="text-[0.625rem] font-normal">
			Est. cost: {formatUsdCost(estimate.total)} (in{" "}
			{formatUsdCost(estimate.input)} · out {formatUsdCost(estimate.output)})
		</Badge>
	);
}

export function TestConnectionDialog({
	open,
	onOpenChange,
	testMode = "quick",
	testStatus,
	testProgress,
	testStep,
	testMessages,
	tokenTotals,
	streamMetrics,
	phaseMetrics = [],
	testError,
	modelLabel,
	inputCostPerMillion,
	outputCostPerMillion,
	onRetest,
	showRetest = false,
}: TestConnectionDialogProps) {
	const [isCopied, setIsCopied] = useState(false);
	const [benchmarkErrorTab, setBenchmarkErrorTab] = useState<"error" | "chat">(
		"error",
	);
	const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
	const isBenchmark = testMode === "benchmark";
	const showBenchmarkErrorTabs = isBenchmark && testStatus === "error";
	const isStreaming = testStatus === "testing";
	const hasStreamMetrics =
		streamMetrics?.ttftMs != null ||
		streamMetrics?.tokensPerSecond != null ||
		streamMetrics?.totalRequestMs != null;
	const statusIcon =
		testStatus === "success" ? (
			<CheckCircle2Icon className="size-4 text-emerald-500" />
		) : testStatus === "error" ? (
			<XCircleIcon className="size-4 text-destructive" />
		) : isStreaming ? (
			<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
		) : null;
	const benchmarkJson = isBenchmark
		? serializeBenchmarkJson({
				modelLabel,
				testStatus,
				testProgress,
				testStep,
				testError,
				tokenTotals,
				streamMetrics,
				phases: phaseMetrics,
				messages: testMessages,
				inputCostPerMillion,
				outputCostPerMillion,
			})
		: "";
	const failedPhaseCount = phaseMetrics.filter(
		(phase) => phase.passed === false,
	).length;
	const filteredBenchmarkMessages = filterBenchmarkMessagesByPhase(
		testMessages,
		selectedPhaseId,
		phaseMetrics,
	);

	const handlePhaseSelect = (phaseId: string) => {
		setSelectedPhaseId((current) => (current === phaseId ? null : phaseId));
	};

	useEffect(() => {
		if (!open) {
			setIsCopied(false);
			setBenchmarkErrorTab("error");
			setSelectedPhaseId(null);
		}
	}, [open]);

	useEffect(() => {
		if (testStatus === "testing") {
			setBenchmarkErrorTab("error");
			setSelectedPhaseId(null);
		}
	}, [testStatus]);

	const copyBenchmarkJson = () => {
		if (
			!benchmarkJson ||
			typeof navigator === "undefined" ||
			!navigator.clipboard
		) {
			return;
		}

		navigator.clipboard.writeText(benchmarkJson).then(() => {
			setIsCopied(true);
			window.setTimeout(() => setIsCopied(false), 2500);
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[44rem] min-h-0 flex-col gap-4 overflow-hidden sm:max-w-4xl">
				<DialogHeader className="shrink-0 gap-2">
					<div className="flex items-start justify-between gap-3 pr-8">
						<div className="space-y-1">
							<DialogTitle className="flex items-center gap-2">
								{statusIcon}
								{testStatus === "error"
									? isBenchmark
										? "Benchmark failed"
										: "Connection failed"
									: isBenchmark
										? "Model benchmark"
										: "Test connection"}
							</DialogTitle>
							<DialogDescription>
								{isBenchmark
									? modelLabel
										? `Multi-phase benchmark with tool calls through ${modelLabel}.`
										: "Runs text and tool phases to measure latency and throughput."
									: modelLabel
										? `Streaming a short prompt through ${modelLabel}.`
										: "Streams a short prompt to verify provider connectivity."}
							</DialogDescription>
						</div>
						{tokenTotals || hasStreamMetrics ? (
							<div className="flex flex-wrap items-center justify-end gap-2">
								<StreamPerfBadges
									streamMetrics={streamMetrics}
									isStreaming={isStreaming}
								/>
								{tokenTotals ? (
									<TokenTotalsBadge tokenTotals={tokenTotals} />
								) : null}
								{tokenTotals ? (
									<CostBreakdown
										tokenTotals={tokenTotals}
										inputCostPerMillion={inputCostPerMillion}
										outputCostPerMillion={outputCostPerMillion}
									/>
								) : null}
							</div>
						) : null}
					</div>
					{testStatus !== "error" ? (
						<div className="space-y-2 rounded-md border border-border bg-background p-3">
							<div className="flex items-center justify-between text-xs">
								<span
									className={cn(
										"text-muted-foreground",
										isStreaming && "text-foreground",
									)}
								>
									{testStep}
								</span>
								<span className="font-medium tabular-nums">
									{testProgress}%
								</span>
							</div>
							<Progress value={testProgress} />
							{isBenchmark ? (
								<div className="space-y-1">
									<PhaseMetricsTable
										phases={phaseMetrics}
										selectedPhaseId={selectedPhaseId}
										onPhaseSelect={handlePhaseSelect}
									/>
									{selectedPhaseId ? (
										<p className="text-[0.7rem] text-muted-foreground">
											Showing chat for{" "}
											{phaseMetrics.find(
												(phase) => phase.phaseId === selectedPhaseId,
											)?.label ?? "selected phase"}
											. Click the row again to show all phases.
										</p>
									) : null}
								</div>
							) : null}
						</div>
					) : null}
				</DialogHeader>

				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
					{showBenchmarkErrorTabs ? (
						<Tabs
							value={benchmarkErrorTab}
							onValueChange={(value) =>
								setBenchmarkErrorTab(value as "error" | "chat")
							}
							className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
						>
							<TabsList className="h-8 shrink-0 bg-muted">
								<TabsTrigger value="error" className="px-3 text-[0.7rem]">
									Failures
									{failedPhaseCount > 0 ? ` (${failedPhaseCount})` : null}
								</TabsTrigger>
								<TabsTrigger value="chat" className="px-3 text-[0.7rem]">
									Chat
								</TabsTrigger>
							</TabsList>

							<TabsContent
								value="error"
								className="min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
							>
								<BenchmarkFailureSummary
									testError={testError}
									testStep={testStep}
									phaseMetrics={phaseMetrics}
									className="min-h-0 flex-1"
								/>
							</TabsContent>

							<TabsContent
								value="chat"
								className="min-h-0 flex-1 gap-2 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
							>
								<BenchmarkChatSection
									messages={testMessages}
									phaseMetrics={phaseMetrics}
									selectedPhaseId={selectedPhaseId}
									onPhaseSelect={handlePhaseSelect}
									isStreaming={isStreaming}
								/>
							</TabsContent>
						</Tabs>
					) : (
						<>
							{testStatus === "error" ? (
								<div className="rounded-md border border-destructive/25 bg-destructive/10 p-4">
									<div className="flex items-start gap-3">
										<XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
										<div className="space-y-1">
											<p className="font-medium text-foreground">
												Connection test failed
											</p>
											<pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
												{testError}
											</pre>
										</div>
									</div>
								</div>
							) : null}

							<ConnectionTestThread
								messages={
									isBenchmark ? filteredBenchmarkMessages : testMessages
								}
								isStreaming={isStreaming}
							/>
						</>
					)}
				</div>

				{showRetest && onRetest ? (
					<DialogFooter className="shrink-0 flex-row flex-wrap justify-end border-t pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
						{isBenchmark ? (
							<Button
								type="button"
								variant="outline"
								onClick={copyBenchmarkJson}
								disabled={!benchmarkJson}
							>
								{isCopied ? (
									<>
										<CheckIcon className="size-4" />
										Copied
									</>
								) : (
									<>
										<CopyIcon className="size-4" />
										Copy JSON
									</>
								)}
							</Button>
						) : null}
						<Button type="button" onClick={onRetest}>
							Test again
						</Button>
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
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
import { StudyAssistantRuntimeProvider } from "@/features/ai/components/assistant-ui/assistant-runtime-provider";
import { Thread } from "@/features/ai/components/assistant-ui/thread";
import {
	TokenTotalsBadge,
	type TokenTotals,
} from "@/features/ai/components/token-totals-badge";
import { useReadOnlyAssistantRuntime } from "@/features/ai/hooks/use-readonly-assistant-runtime";
import {
	formatTokensPerSecond,
	formatTtft,
	type StreamPerfMetrics,
} from "@/features/ai/lib/stream-perf-metrics";
import {
	estimateTokenCost,
	formatUsdCost,
} from "@/features/ai/lib/token-usage";
import { cn } from "@/lib/utils";
import type { TestStatus } from "./use-connection-test";

type TestConnectionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	testStatus: TestStatus;
	testProgress: number;
	testStep: string;
	testMessages: UIMessage[];
	tokenTotals: TokenTotals | null;
	streamMetrics?: StreamPerfMetrics | null;
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

	const { ttftMs, tokensPerSecond } = streamMetrics;
	const showTtft = ttftMs != null;
	const showThroughput = tokensPerSecond != null;

	if (!showTtft && !showThroughput) {
		return null;
	}

	return (
		<>
			{showTtft ? (
				<Badge variant="outline" className="text-[0.625rem] font-normal">
					TTFT: {formatTtft(ttftMs)}
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
	testStatus,
	testProgress,
	testStep,
	testMessages,
	tokenTotals,
	streamMetrics,
	testError,
	modelLabel,
	inputCostPerMillion,
	outputCostPerMillion,
	onRetest,
	showRetest = false,
}: TestConnectionDialogProps) {
	const isStreaming = testStatus === "testing";
	const hasStreamMetrics =
		streamMetrics?.ttftMs != null || streamMetrics?.tokensPerSecond != null;
	const statusIcon =
		testStatus === "success" ? (
			<CheckCircle2Icon className="size-4 text-emerald-500" />
		) : testStatus === "error" ? (
			<XCircleIcon className="size-4 text-destructive" />
		) : isStreaming ? (
			<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
		) : null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[44rem] min-h-0 flex-col gap-4 overflow-hidden sm:max-w-4xl">
				<DialogHeader className="shrink-0 gap-2">
					<div className="flex items-start justify-between gap-3 pr-8">
						<div className="space-y-1">
							<DialogTitle className="flex items-center gap-2">
								{statusIcon}
								{testStatus === "error"
									? "Connection failed"
									: "Test connection"}
							</DialogTitle>
							<DialogDescription>
								{modelLabel
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
								<span className="font-medium tabular-nums">{testProgress}%</span>
							</div>
							<Progress value={testProgress} />
						</div>
					) : null}
				</DialogHeader>

				{testStatus === "error" ? (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{testError}
					</div>
				) : (
					<ConnectionTestThread
						messages={testMessages}
						isStreaming={isStreaming}
					/>
				)}

				{showRetest && onRetest ? (
					<DialogFooter className="shrink-0 border-t pt-4">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
						<Button type="button" onClick={onRetest}>
							Test again
						</Button>
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

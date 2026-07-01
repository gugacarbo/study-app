"use client";

import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import {
	Reasoning,
	ReasoningContent,
	ReasoningRoot,
	ReasoningText,
	ReasoningTrigger,
} from "@/components/assistant-ui/reasoning";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import {
	ToolGroupContent,
	ToolGroupRoot,
	ToolGroupTrigger,
	shouldRenderToolGroup,
} from "@/components/assistant-ui/tool-group";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	AuiIf,
	groupPartByType,
	MessagePrimitive,
	ThreadPrimitive,
	type ToolCallMessagePartProps,
	useAuiState,
} from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import {
	ArrowDownIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CircleIcon,
	LoaderCircleIcon,
	XIcon,
	DollarSign,
} from "lucide-react";
import {
	SYSTEM_KIND_FALLBACK,
	SYSTEM_KIND_VISUALS,
} from "@/features/background-processes/lib/system-kind-visuals";
import { useEffect, useState, type FC, type PropsWithChildren } from "react";
import type { IngestProgressState } from "@/features/background-processes/lib/ingest-event-mapper";
import { formatPhaseLabel } from "@/features/background-processes/lib/ingest-event-mapper";
import {
	INGEST_PHASE,
	type IngestJobMetadata,
	JOB_STATUS,
	type JobStatus,
} from "@/lib/job-kinds";

export type IngestThreadProps = {
	isRunning: boolean;
	status?: JobStatus | null;
	phase?: string | null;
	metadata?: IngestJobMetadata | null;
	progress?: IngestProgressState;
	title?: string;
	showHeader?: boolean;
};

const STATUS_BADGE_LABELS: Partial<Record<JobStatus, string>> = {
	[JOB_STATUS.AWAITING_UPLOAD]: "Aguardando upload",
	[JOB_STATUS.QUEUED]: "Na fila",
	[JOB_STATUS.RUNNING]: "Em execução",
	[JOB_STATUS.COMPLETED]: "Concluído",
	[JOB_STATUS.FAILED]: "Falhou",
	[JOB_STATUS.CANCELLED]: "Cancelado",
};

const PHASE_BADGE_LABELS: Record<string, string> = {
	[INGEST_PHASE.READING_FILE]: "Lendo arquivo",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões",
	[INGEST_PHASE.REVIEWING]: "Revisando questões",
	[INGEST_PHASE.PERSISTING]: "Salvando questões",
};

function StatusIcon({ status }: { status: JobStatus | null | undefined }) {
	switch (status) {
		case JOB_STATUS.QUEUED:
		case JOB_STATUS.RUNNING:
			return (
				<LoaderCircleIcon className="size-3 animate-spin" aria-hidden />
			);
		case JOB_STATUS.COMPLETED:
			return <CheckIcon className="size-3" aria-hidden />;
		case JOB_STATUS.FAILED:
		case JOB_STATUS.CANCELLED:
			return <XIcon className="size-3" aria-hidden />;
		default:
			return <CircleIcon className="size-3" aria-hidden />;
	}
}

function StatusBadge({
	status,
	phase,
	metadata,
	progress,
}: {
	status: JobStatus | null | undefined;
	phase: string | null | undefined;
	metadata: IngestJobMetadata | null | undefined;
	progress: IngestProgressState | undefined;
}) {
	const statusLabel =
		status != null ? (STATUS_BADGE_LABELS[status] ?? status) : "Carregando…";
	const isFailed = status === JOB_STATUS.FAILED;

	const phaseLabel = phase
		? (PHASE_BADGE_LABELS[phase] ?? formatPhaseLabel(phase as Parameters<typeof formatPhaseLabel>[0]))
		: null;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant={isFailed ? "destructive" : "secondary"}
						className="gap-1.5"
					>
						<StatusIcon status={status} />
						{statusLabel}
					</Badge>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="flex flex-col gap-1">
					{metadata?.fileName ? (
						<span className="font-medium">{metadata.fileName}</span>
					) : null}
					{phaseLabel ? (
						<span>Fase: {phaseLabel}</span>
					) : null}
					{progress?.questionsSeen != null && progress.questionsSeen > 0 ? (
						<span>
							{progress.questionsSeen} questão(ões) identificada(s)
						</span>
					) : null}
					{progress?.persisted != null ? (
						<span>{progress.persisted} salva(s)</span>
					) : null}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function formatTokenCount(value: number): string {
	return value.toLocaleString("pt-BR");
}

function TokenUsageBadge({
	metadata,
}: {
	metadata: IngestJobMetadata | null | undefined;
}) {
	const totalTokens = metadata?.totalTokens;
	const inputTokens = metadata?.inputTokens;
	const outputTokens = metadata?.outputTokens;
	const cost = metadata?.cost;

	if (totalTokens == null && inputTokens == null && outputTokens == null) {
		return null;
	}

	const total = totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge variant="outline" className="ml-auto gap-1">
						<DollarSign className="size-3" />
						{formatTokenCount(total)}
					</Badge>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="flex flex-col gap-1">
					{inputTokens != null ? (
						<span>
							Entrada: {formatTokenCount(inputTokens)} tokens
						</span>
					) : null}
					{outputTokens != null ? (
						<span>
							Saída: {formatTokenCount(outputTokens)} tokens
						</span>
					) : null}
					{total != null ? (
						<span>
							Total: {formatTokenCount(total)} tokens
						</span>
					) : null}
					{cost != null ? (
						<span>
							Custo: R$ {cost.toFixed(4)}
						</span>
					) : null}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

const IngestThreadMessage: FC = () => {
	const role = useAuiState((s) => s.message.role);
	if (role === "system") return <IngestSystemMessage />;
	return <IngestAssistantMessage />;
};

function parseSystemMessageId(id: string | undefined): string | null {
	if (!id) return null;
	if (id.startsWith("system:")) return id.slice("system:".length);
	return null;
}

const IngestSystemMessage: FC = () => {
	const id = useAuiState((s) => s.message.id);
	const rawContent = useAuiState((s) => s.message.content);
	const content =
		typeof rawContent === "string"
			? rawContent
			: Array.isArray(rawContent)
				? (rawContent.find((p): p is { type: "text"; text: string } => p.type === "text")?.text ?? "")
				: "";
	const status = useAuiState((s) => s.message.status);
	const isLast = useAuiState((s) => s.message.isLast);
	const isRunning = useAuiState((s) => s.thread.isRunning);
	const kind = parseSystemMessageId(id);
	const visual = kind
		? (SYSTEM_KIND_VISUALS[kind] ?? SYSTEM_KIND_FALLBACK)
		: SYSTEM_KIND_FALLBACK;
	const Icon = visual.icon;
	const active = isLast && isRunning && status?.type !== "complete";
	const [manuallyExpanded, setManuallyExpanded] = useState(false);

	const isExpanded = isLast || manuallyExpanded;
	const isCompact = !isExpanded;

	return (
		<MessagePrimitive.Root
			className="flex w-full justify-center py-1"
			data-role="system"
			data-message-id={id}
		>
			<div
				className={cn(
					"flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all",
					visual.borderClass,
					visual.bgClass,
					visual.textClass,
					active && "animate-pulse",
					isCompact && "opacity-70",
				)}
			>
				<Icon className="size-3.5" aria-hidden />
				<span
					className={cn(
						"font-medium",
						isCompact && "max-w-[12rem] truncate",
					)}
				>
					{content}
				</span>
				{!isLast ? (
					<button
						type="button"
						onClick={() => setManuallyExpanded((v) => !v)}
						className="-me-1 rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
						aria-label={manuallyExpanded ? "Recolher" : "Expandir"}
					>
						{manuallyExpanded ? (
							<ChevronUpIcon className="size-3" aria-hidden />
						) : (
							<ChevronDownIcon className="size-3" aria-hidden />
						)}
					</button>
				) : null}
			</div>
		</MessagePrimitive.Root>
	);
};

// Tool calls: always start collapsed.
const IngestToolPart: FC<ToolCallMessagePartProps> = (part) => (
	<ToolFallback.Root defaultOpen={false}>
		<ToolFallback.Trigger toolName={part.toolName} status={part.status} />
		<ToolFallback.Content>
			<ToolFallback.Error status={part.status} />
			<ToolFallback.Args argsText={part.argsText} />
			<ToolFallback.Result result={part.result} />
		</ToolFallback.Content>
	</ToolFallback.Root>
);

// Tool group: starts expanded while its sequence is the active one, then
// collapses once a subsequent group takes over. Mirrors the behavior of the
// built-in reasoning group.
const IngestToolGroup: FC<
	PropsWithChildren<{ startIndex: number; endIndex: number }>
> = ({ children, startIndex, endIndex }) => {
	const isActive = useAuiState((s) => {
		if (s.message.status?.type !== "running") return false;
		const lastIndex = s.message.parts.length - 1;
		if (lastIndex < 0) return false;
		const lastPart = s.message.parts[lastIndex];
		if (lastPart?.type !== "tool-call") return false;
		return lastIndex >= startIndex && lastIndex <= endIndex;
	});

	const [open, setOpen] = useState(isActive);
	useEffect(() => {
		setOpen(isActive);
	}, [isActive]);

	return (
		<ToolGroupRoot variant="ghost" open={open} onOpenChange={setOpen}>
			<ToolGroupTrigger
				count={endIndex - startIndex + 1}
				active={isActive}
			/>
			<ToolGroupContent>{children}</ToolGroupContent>
		</ToolGroupRoot>
	);
};

const IngestAssistantMessage: FC = () => (
	<MessagePrimitive.Root
		data-role="assistant"
		className="fade-in slide-in-from-bottom-1 animate-in relative duration-150"
	>
		<div className="text-foreground px-2 leading-relaxed wrap-break-word [contain-intrinsic-size:auto_24px] [content-visibility:auto]">
			<MessagePrimitive.GroupedParts
				groupBy={groupPartByType({
					reasoning: ["group-chainOfThought", "group-reasoning"],
					"tool-call": ["group-chainOfThought", "group-tool"],
					"standalone-tool-call": [],
				})}
			>
				{({ part, children }) => {
					switch (part.type) {
						case "text":
							return <MarkdownText />;
						case "reasoning":
							return <Reasoning {...part} />;
						case "tool-call":
							return <IngestToolPart {...part} />;
						case "group-chainOfThought":
							return (
								<div data-slot="aui_chain-of-thought" className="mb-3">
									{children}
								</div>
							);
						case "group-tool":
							if (!shouldRenderToolGroup(part.indices.length)) {
								return <>{children}</>;
							}
							return (
								<IngestToolGroup
									startIndex={part.indices[0] ?? 0}
									endIndex={
										part.indices[part.indices.length - 1] ?? 0
									}
								>
									{children}
								</IngestToolGroup>
							);
						case "group-reasoning": {
							const running = part.status.type === "running";
							return (
								<ReasoningRoot streaming={running}>
									<ReasoningTrigger active={running} />
									<ReasoningContent aria-busy={running}>
										<ReasoningText>{children}</ReasoningText>
									</ReasoningContent>
								</ReasoningRoot>
							);
						}
						default:
							return null;
					}
				}}
			</MessagePrimitive.GroupedParts>
		</div>
	</MessagePrimitive.Root>
);

const IngestScrollToBottom: FC = () => (
	<ThreadPrimitive.ScrollToBottom asChild>
		<TooltipIconButton
			tooltip="Rolar para o fim"
			variant="outline"
			className="absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
		>
			<ArrowDownIcon />
		</TooltipIconButton>
	</ThreadPrimitive.ScrollToBottom>
);

export const IngestThread: FC<IngestThreadProps> = ({
	isRunning,
	status,
	phase,
	metadata,
	progress,
	title = "Atividade",
	showHeader = true,
}) => (
	<ThreadPrimitive.Root
		className="aui-root aui-thread-root bg-background flex h-full min-h-0 flex-col"
		style={{
			["--thread-max-width" as string]: "100%",
		}}
	>
		{showHeader ? (
			<div className="border-b px-4 py-2">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-medium">{title}</h2>
					<StatusBadge
						status={status}
						phase={phase}
						metadata={metadata}
						progress={progress}
					/>
					<TokenUsageBadge metadata={metadata} />
				</div>
			</div>
		) : null}
		<ThreadPrimitive.Viewport
			autoScroll
			turnAnchor="top"
			className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth"
		>
			<div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
				<AuiIf condition={(s) => s.thread.isEmpty}>
					<p className="text-sm text-muted-foreground">
						Aguardando atualizações do agente…
					</p>
				</AuiIf>

				<div className="mb-4 flex flex-col gap-y-6 empty:hidden">
					<ThreadPrimitive.Messages>
						{() => <IngestThreadMessage />}
					</ThreadPrimitive.Messages>
				</div>

				<ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer bg-background sticky bottom-0 mt-auto flex flex-col gap-2 pb-4">
					<IngestScrollToBottom />
					{isRunning ? (
						<p className="text-xs text-muted-foreground animate-pulse">
							Processando…
						</p>
					) : null}
				</ThreadPrimitive.ViewportFooter>
			</div>
		</ThreadPrimitive.Viewport>
	</ThreadPrimitive.Root>
);

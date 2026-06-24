"use client";

import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckCheckIcon,
	Clock3Icon,
	CopyIcon,
	GaugeIcon,
	HashIcon,
	RotateCcw,
	TimerIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FC } from "react";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import {
	Reasoning,
	ReasoningContent,
	ReasoningRoot,
	ReasoningText,
	ReasoningTrigger,
} from "@/components/assistant-ui/reasoning";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildProbeAssistantContent } from "@/features/admin/components/model-test-stream-content";
import type { ModelProbeStreamState } from "@/features/admin/hooks/use-model-probe-stream";
import type { ModelProbeRequest } from "@/features/admin/types/model-probe";
import {
	AssistantRuntimeProvider,
	AuiIf,
	groupPartByType,
	MessagePrimitive,
	ThreadPrimitive,
	useAuiState,
	useExternalStoreRuntime,
	type ThreadMessageLike,
} from "@assistant-ui/react";

function formatProbeJson(result: NonNullable<ModelProbeStreamState["result"]>) {
	return JSON.stringify(
		{
			request: result.request,
			response: result.response,
			http: result.http,
		},
		null,
		2,
	);
}

function formatInteger(value: number | null | undefined) {
	return value == null ? "—" : Intl.NumberFormat("pt-BR").format(value);
}

function formatMs(value: number | null | undefined) {
	if (value == null) return "—";
	return `${Math.round(value)} ms`;
}

function formatSeconds(value: number | null | undefined) {
	if (value == null) return "—";
	return `${(value / 1000).toFixed(2)} s`;
}

function formatRate(value: number | null | undefined) {
	if (value == null) return "—";
	return value.toFixed(1);
}

type ProbeThreadMessage = {
	id: string;
	role: "user" | "assistant";
	content: ThreadMessageLike["content"];
	seq: number;
	status?: "running" | "complete";
};

type ModelTestDialogConfig = {
	testedModelId: string;
	prompt: string;
	timeoutMs: number;
	thinkingMode: "none" | "toggle" | "levels";
	thinkingOptions: string[];
	reasoningEffort?: string | null;
};

function useProbeThreadRuntime(
	stream: ModelProbeStreamState,
	requestPrompt: string | null,
) {
	const isStreaming = stream.status === "streaming";
	const messages = useMemo<ProbeThreadMessage[]>(() => {
		const list: ProbeThreadMessage[] = [];
		if (stream.status !== "idle" && requestPrompt) {
			list.push({
				id: "probe-user",
				role: "user",
				content: requestPrompt,
				seq: 0,
			});
		}
		if (stream.status !== "idle") {
			list.push({
				id: "probe-assistant",
				role: "assistant",
				content: buildProbeAssistantContent(stream.assistantText),
				seq: 1,
				status: isStreaming ? "running" : "complete",
			});
		}
		const errorText = stream.result?.response.error?.trim();
		if (
			(stream.status === "error" ||
				(stream.status === "done" && stream.result && !stream.result.ok)) &&
			errorText
		) {
			list.push({
				id: "probe-assistant-error",
				role: "assistant",
				content: [{ type: "text", text: `Erro: ${errorText}` }],
				seq: 2,
				status: "complete",
			});
		}
		return list;
	}, [stream.status, stream.assistantText, stream.result, isStreaming, requestPrompt]);

	return useExternalStoreRuntime<ProbeThreadMessage>({
		messages,
		isRunning: isStreaming,
		isDisabled: true,
		convertMessage: (message) => ({
			id: message.id,
			role: message.role,
			content: message.content,
		}),
		onNew: async () => {},
	});
}

function extractTextFromContent(
	content: ThreadMessageLike["content"],
): string {
	if (typeof content === "string") return content;
	return content
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.map((part) => part.text)
		.join("");
}

const ProbeUserMessage: FC = () => {
	const text = useAuiState((s) => extractTextFromContent(s.message.content));
	return (
		<MessagePrimitive.Root
			data-role="user"
			className="fade-in slide-in-from-bottom-1 animate-in flex justify-end duration-150"
		>
			<div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2 text-sm whitespace-pre-wrap shadow-sm">
				{text}
			</div>
		</MessagePrimitive.Root>
	);
};

const ProbeAssistantMessage: FC = () => {
	const isRunning = useAuiState((s) => s.thread.isRunning);
	const isLast = useAuiState((s) => s.message.isLast);

	return (
		<MessagePrimitive.Root
			data-role="assistant"
			className="fade-in slide-in-from-bottom-1 animate-in relative duration-150"
		>
			<div className="text-foreground min-w-0 px-2 leading-relaxed wrap-break-word">
				<MessagePrimitive.GroupedParts
					groupBy={groupPartByType({
						reasoning: ["group-reasoning"],
					})}
				>
					{({ part, children }) => {
						switch (part.type) {
							case "text":
								return <MarkdownText />;
							case "reasoning":
								return <Reasoning {...part} />;
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
				{isRunning && isLast ? (
					<span
						aria-hidden
						className="ml-0.5 inline-block animate-pulse font-sans"
					>
						▍
					</span>
				) : null}
			</div>
		</MessagePrimitive.Root>
	);
};

const ProbeThreadMessage: FC = () => {
	const role = useAuiState((s) => s.message.role);
	if (role === "user") return <ProbeUserMessage />;
	return <ProbeAssistantMessage />;
};

const ModelProbeThread: FC<{
	stream: ModelProbeStreamState;
	requestPrompt: string | null;
}> = ({ stream, requestPrompt }) => {
	const runtime = useProbeThreadRuntime(stream, requestPrompt);

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<ThreadPrimitive.Root
				className="aui-root aui-thread-root bg-background flex h-full min-h-0 flex-col"
				style={{ ["--thread-max-width" as string]: "100%" }}
			>
				<ThreadPrimitive.Viewport
					autoScroll
					turnAnchor="top"
					className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth"
				>
					<div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4">
						<AuiIf condition={(s) => s.thread.isEmpty}>
							<p className="text-sm text-muted-foreground">
								Configure o teste e clique em iniciar para ver a conversa com o
								modelo.
							</p>
						</AuiIf>
						<div className="flex flex-col gap-y-6 empty:hidden">
							<ThreadPrimitive.Messages>
								{() => <ProbeThreadMessage />}
							</ThreadPrimitive.Messages>
						</div>
					</div>
				</ThreadPrimitive.Viewport>
			</ThreadPrimitive.Root>
		</AssistantRuntimeProvider>
	);
};

function ProbeStats({ stream }: { stream: ModelProbeStreamState }) {
	const usage = stream.result?.response.usage;
	const stats = [
		{
			id: "input",
			label: "Input",
			value: formatInteger(usage?.inputTokens),
			icon: ArrowDownIcon,
		},
		{
			id: "output",
			label: "Output",
			value: formatInteger(usage?.outputTokens),
			icon: ArrowUpIcon,
		},
		{
			id: "total",
			label: "Total",
			value: formatInteger(usage?.totalTokens),
			icon: HashIcon,
		},
		{
			id: "ttft",
			label: "TTFT",
			value: formatMs(stream.metrics.timeToFirstTokenMs),
			icon: TimerIcon,
		},
		{
			id: "duration",
			label: "Duração",
			value: formatSeconds(stream.metrics.totalDurationMs),
			icon: Clock3Icon,
		},
		{
			id: "tokens-per-second",
			label: "Tokens/s",
			value: formatRate(stream.metrics.outputTokensPerSecond),
			icon: GaugeIcon,
		},
		{
			id: "finish",
			label: "Finish",
			value: stream.result?.response.finishReason ?? "—",
			icon: CheckCheckIcon,
		},
	];

	return (
		<div
			data-testid="probe-stats"
			className="grid gap-2 border-b px-6 py-2 sm:grid-cols-3 xl:grid-cols-7"
		>
			{stats.map((stat) => {
				const Icon = stat.icon;
				return (
					<div
						key={stat.id}
						data-testid={`probe-stat-${stat.id}`}
						className="flex items-center justify-between gap-2 rounded-md border bg-muted/15 px-2 py-1"
					>
						<div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
							<Icon
								data-testid={`probe-stat-icon-${stat.id}`}
								className="size-3 shrink-0"
							/>
							<span>{stat.label}</span>
						</div>
						<p className="text-xs font-medium leading-none">{stat.value}</p>
					</div>
				);
			})}
		</div>
	);
}

function buildInitialConfig(defaultConfig: ModelTestDialogConfig) {
	return {
		testedModelId: defaultConfig.testedModelId,
		prompt: defaultConfig.prompt,
		timeoutSeconds: Math.max(1, Math.round(defaultConfig.timeoutMs / 1000)),
		reasoningEffort: defaultConfig.reasoningEffort ?? "",
	};
}

export function ModelTestStreamDialog({
	open,
	title,
	stream,
	defaultConfig,
	onClose,
	onStart,
}: {
	open: boolean;
	title: string;
	stream: ModelProbeStreamState;
	defaultConfig: ModelTestDialogConfig;
	onClose: () => void;
	onStart: (config: ModelTestDialogConfig) => void;
}) {
	const [copied, setCopied] = useState(false);
	const [view, setView] = useState<"chat" | "raw">("chat");
	const [activeRequest, setActiveRequest] = useState<ModelProbeRequest | null>(null);
	const [formState, setFormState] = useState(() => buildInitialConfig(defaultConfig));

	useEffect(() => {
		setCopied(false);
		if (!open) {
			setView("chat");
			setActiveRequest(null);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		setFormState(buildInitialConfig(defaultConfig));
	}, [defaultConfig, open]);

	useEffect(() => {
		if (stream.result?.request) {
			setActiveRequest(stream.result.request);
		}
	}, [stream.result]);

	async function handleCopy() {
		if (!stream.result) return;
		await navigator.clipboard.writeText(formatProbeJson(stream.result));
		setCopied(true);
		window.setTimeout(() => setCopied(false), 2000);
	}

	function handleStart() {
		const timeoutSeconds = Math.max(1, Number(formState.timeoutSeconds) || 1);
		const config = {
			testedModelId: defaultConfig.testedModelId,
			prompt: formState.prompt.trim() || defaultConfig.prompt,
			timeoutMs: timeoutSeconds * 1000,
			thinkingMode: defaultConfig.thinkingMode,
			thinkingOptions: defaultConfig.thinkingOptions,
			reasoningEffort: formState.reasoningEffort.trim() || null,
		};
		setActiveRequest({
			modelRowId: stream.result?.request.modelRowId ?? "",
			savedModelId: stream.result?.request.savedModelId ?? config.testedModelId,
			testedModelId: config.testedModelId,
			displayName: stream.result?.request.displayName ?? title,
			providerName: stream.result?.request.providerName ?? "",
			providerBaseUrl: stream.result?.request.providerBaseUrl ?? "",
			prompt: config.prompt,
			maxOutputTokens: stream.result?.request.maxOutputTokens ?? 0,
			timeoutMs: config.timeoutMs,
			reasoningEffort: config.reasoningEffort,
		});
		onStart(config);
	}

	const isStreaming = stream.status === "streaming";
	const isError = stream.status === "error";
	const result = stream.result;
	const showSuccess = stream.status === "done" && result?.ok;
	const hasRaw = result != null;
	const requestPrompt = activeRequest?.prompt ?? null;

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="z-60 flex h-[90vh] max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 p-0 sm:max-w-5xl"
			>
				<DialogHeader className="border-b px-6 py-4 pr-4">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0 space-y-1">
							<DialogTitle className="text-base">{title}</DialogTitle>
							<DialogDescription>
								Ajuste os parâmetros do teste antes de enviar a requisição para
								o modelo.
							</DialogDescription>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<span className="text-sm text-muted-foreground">Status</span>
							{isStreaming ? (
								<Badge variant="secondary">Gerando…</Badge>
							) : showSuccess ? (
								<Badge>Sucesso</Badge>
							) : isError || (result && !result.ok) ? (
								<Badge variant="destructive">Falha</Badge>
							) : (
								<Badge variant="secondary">Aguardando…</Badge>
							)}
							<Button variant="ghost" size="icon-sm" onClick={onClose}>
								<XIcon />
								<span className="sr-only">Fechar</span>
							</Button>
						</div>
					</div>
				</DialogHeader>

				<div
					data-testid="probe-form-layout"
					className="grid gap-4 border-b px-6 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-stretch"
				>
					<div className="flex h-full min-h-0 flex-col gap-2">
						<div className="flex items-center gap-2">
							<Label htmlFor="probe-prompt">Prompt do teste</Label>
							<Button
								variant="ghost"
								size="icon-xs"
								title="Restaurar prompt padrão"
								disabled={isStreaming}
								onClick={() =>
									setFormState((current) => ({
										...current,
										prompt: defaultConfig.prompt,
									}))
								}
							>
								<RotateCcw />
							</Button>
						</div>
						<Textarea
							id="probe-prompt"
							rows={2}
							className="min-h-0 flex-1 resize-none"
							value={formState.prompt}
							disabled={isStreaming}
							onChange={(event) =>
								setFormState((current) => ({
									...current,
									prompt: event.target.value,
								}))
							}
						/>
					</div>
					<div
						data-testid="probe-controls-layout"
						className="grid h-full min-h-0 grid-cols-2 content-between gap-3"
					>
						<div className="space-y-2 col-span-1">
							<Label htmlFor="probe-timeout">Timeout (s)</Label>
							<Input
								id="probe-timeout"
								type="number"
								min={1}
								step={1}
								className="h-9"
								value={formState.timeoutSeconds}
								disabled={isStreaming}
								onChange={(event) =>
									setFormState((current) => ({
										...current,
										timeoutSeconds: Number(event.target.value),
									}))
								}
							/>
						</div>
						<div className="space-y-2 col-span-1">
							<Label htmlFor="probe-reasoning">Thinking</Label>
							<Select
								value={formState.reasoningEffort}
								disabled={isStreaming || defaultConfig.thinkingMode === "none"}
								onValueChange={(value) =>
									setFormState((current) => ({
										...current,
										reasoningEffort: value,
									}))
								}
							>
								<SelectTrigger id="probe-reasoning" className="w-full h-9">
									<SelectValue placeholder="Selecione" />
								</SelectTrigger>
								<SelectContent className="z-70">
									<SelectGroup>
										{defaultConfig.thinkingOptions.map((option) => (
											<SelectItem key={option} value={option}>
												{option}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
						<div className="col-span-2 flex">
							<Button
								type="button"
								className="h-full min-h-9 w-full"
								disabled={isStreaming}
								onClick={handleStart}
							>
								{isStreaming ? "Testando…" : "Iniciar teste"}
							</Button>
						</div>
					</div>
				</div>

				<ProbeStats stream={stream} />

				<div className="min-h-0 flex-1">
					{view === "chat" ? (
						<div className="h-full overflow-hidden px-0 py-4">
							<ModelProbeThread stream={stream} requestPrompt={requestPrompt} />
						</div>
					) : (
						<div className="flex h-full flex-col gap-4 p-6">
							{isError && result?.response.responseBody ? (
								<Alert variant="destructive">
									<AlertDescription>
										<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
											{result.response.responseBody}
										</pre>
									</AlertDescription>
								</Alert>
							) : null}
							<div className="relative flex min-h-0 flex-1 flex-col rounded-lg border bg-muted/20">
								<pre className="flex-1 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap break-all">
									{hasRaw ? formatProbeJson(result) : "Sem dados brutos."}
								</pre>
							</div>
						</div>
					)}
				</div>

				<div className="flex items-center justify-between gap-2 border-t px-6 py-4">
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={!hasRaw}
							onClick={() =>
								setView((current) => (current === "chat" ? "raw" : "chat"))
							}
						>
							{view === "chat" ? "Ver raw" : "Voltar ao chat"}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={!result}
							onClick={handleCopy}
						>
							<CopyIcon />
							{copied ? "Copiado!" : "Copiar JSON"}
						</Button>
					</div>
					<Button onClick={onClose}>Fechar</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

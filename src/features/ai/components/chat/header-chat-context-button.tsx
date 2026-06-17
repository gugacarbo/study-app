import { useSelector } from "@tanstack/react-store";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { PageChatContext } from "@/features/ai/context/page-chat-context";
import { getChatRuntimeStatsStore } from "@/features/ai/stores/chat-runtime-stats-store";
import { CHAT_RUNTIME_MESSAGE_LIMIT } from "@/lib/chat-conversations/constants";
import { cn } from "@/lib/utils";

interface HeaderChatContextButtonProps {
	pageContext: PageChatContext;
	conversationId: string | null;
	savedMessageCount: number;
	isTruncated: boolean;
}

export function HeaderChatContextButton({
	pageContext,
	conversationId,
	savedMessageCount,
	isTruncated,
}: HeaderChatContextButtonProps) {
	const runtimeStats = useSelector(getChatRuntimeStatsStore(), (state) =>
		state.conversationId === conversationId ? state : null,
	);

	const clientToolEntries = pageContext.clientTools
		? Object.entries(pageContext.clientTools)
		: [];

	const runtimeMessageCount =
		runtimeStats?.runtimeMessageCount ??
		Math.min(savedMessageCount, CHAT_RUNTIME_MESSAGE_LIMIT);
	const contextCharacterCount = runtimeStats?.contextCharacterCount ?? 0;

	const lastInputTokens = runtimeStats?.inputTokens ?? null;
	const lastOutputTokens = runtimeStats?.outputTokens ?? null;
	const contextTokens = runtimeStats?.contextTokens ?? lastInputTokens;
	const hasTokenData =
		lastInputTokens != null ||
		lastOutputTokens != null ||
		contextTokens != null;

	const contextUsagePercent =
		runtimeStats?.contextWindow != null &&
		runtimeStats.contextWindow > 0 &&
		contextTokens != null
			? Math.min(
					100,
					Math.round((contextTokens / runtimeStats.contextWindow) * 100),
				)
			: null;

	const contextUsageTitle =
		contextTokens != null && runtimeStats?.contextWindow != null
			? `${formatTokenNumber(contextTokens)} / ${formatTokenNumber(runtimeStats.contextWindow)} tokens (${contextUsagePercent ?? 0}%)`
			: contextTokens != null
				? `${formatTokenNumber(contextTokens)} tokens`
				: undefined;

	return (
		<Popover modal={false}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="size-6 shrink-0"
					title="Contexto da página"
					aria-label="Contexto da página"
				>
					<Info className="size-3.5" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={6}
				className="max-h-[min(480px,75vh)] w-72 gap-2 overflow-y-auto p-2.5"
			>
				<PopoverHeader className="gap-0">
					<PopoverTitle className="text-xs">Contexto</PopoverTitle>
				</PopoverHeader>

				<ContextSection title="Página">
					<dl className="space-y-0.5 text-[11px]">
						<ContextRow label="Página" value={pageContext.label} />
						<ContextRow label="Rota" value={pageContext.route} mono />
						<ContextRow label="Tipo" value={pageContext.pageType} />
						{pageContext.examId ? (
							<ContextRow label="Prova" value={pageContext.examId} mono />
						) : null}
						{pageContext.questionId ? (
							<ContextRow label="Questão" value={pageContext.questionId} mono />
						) : null}
						{pageContext.summary ? (
							<ContextRow label="Resumo" value={pageContext.summary} multiline />
						) : null}
					</dl>
				</ContextSection>

				<ContextSection title="Histórico">
					<p className="text-[11px] leading-snug text-foreground">
						{savedMessageCount} salvas · {runtimeMessageCount}/
						{CHAT_RUNTIME_MESSAGE_LIMIT} runtime
						{isTruncated ? (
							<span className="text-amber-600 dark:text-amber-400">
								{" "}
								· truncado
							</span>
						) : null}
					</p>
					<p className="text-[10px] text-muted-foreground">
						~{contextCharacterCount.toLocaleString("pt-BR")} caracteres no
						prompt
					</p>
				</ContextSection>

				<ContextSection title="Tokens">
					{hasTokenData ? (
						<div className="space-y-1 text-[11px]">
							<TokenLine
								label="Entrada"
								last={lastInputTokens}
								session={runtimeStats?.sessionInputTokens ?? null}
							/>
							<TokenLine
								label="Saída"
								last={lastOutputTokens}
								session={runtimeStats?.sessionOutputTokens ?? null}
							/>
							<div className="space-y-0.5">
								<div className="flex items-baseline justify-between gap-2">
									<span className="shrink-0 text-muted-foreground">
										Contexto
									</span>
									<span
										className="truncate text-right font-medium tabular-nums"
										title={contextUsageTitle}
									>
										{contextTokens != null &&
										runtimeStats?.contextWindow != null ? (
											<>
												{formatTokenNumber(contextTokens)}
												<span className="text-muted-foreground font-normal">
													{" "}
													/ {formatTokenNumber(runtimeStats.contextWindow)}
												</span>
												{contextUsagePercent != null ? (
													<span className="text-muted-foreground font-normal">
														{" "}
														· {contextUsagePercent}%
													</span>
												) : null}
											</>
										) : (
											formatTokenValue(contextTokens)
										)}
									</span>
								</div>
								{contextUsagePercent != null ? (
									<div className="h-1 overflow-hidden rounded-full bg-muted">
										<div
											className={cn(
												"h-full rounded-full transition-all",
												contextUsagePercent >= 85
													? "bg-destructive"
													: contextUsagePercent >= 65
														? "bg-amber-500"
														: "bg-primary",
											)}
											style={{ width: `${contextUsagePercent}%` }}
										/>
									</div>
								) : null}
							</div>
							{runtimeStats?.reasoningTokens != null ||
							runtimeStats?.cachedInputTokens != null ? (
								<p className="truncate text-[10px] text-muted-foreground">
									{runtimeStats?.reasoningTokens != null
										? `reasoning ${formatTokenNumber(runtimeStats.reasoningTokens)}`
										: null}
									{runtimeStats?.reasoningTokens != null &&
									runtimeStats?.cachedInputTokens != null
										? " · "
										: null}
									{runtimeStats?.cachedInputTokens != null
										? `cache ${formatTokenNumber(runtimeStats.cachedInputTokens)}`
										: null}
								</p>
							) : null}
							{runtimeStats?.modelDisplayName ? (
								<p
									className="truncate text-[10px] text-muted-foreground"
									title={runtimeStats.modelDisplayName}
								>
									{runtimeStats.modelDisplayName}
									{runtimeStats.contextWindow != null
										? ` · janela ${formatTokenNumber(runtimeStats.contextWindow)}`
										: null}
								</p>
							) : null}
						</div>
					) : (
						<p className="text-[10px] leading-snug text-muted-foreground">
							{savedMessageCount > 0
								? "Tokens nas próximas respostas."
								: "Envie uma mensagem para ver tokens."}
						</p>
					)}
				</ContextSection>

				{clientToolEntries.length > 0 ? (
					<ContextSection title="Tools">
						<ul className="space-y-0.5">
							{clientToolEntries.map(([name, tool]) => (
								<li
									key={name}
									className="rounded bg-muted/50 px-1.5 py-1 text-[10px] leading-snug"
								>
									<span className="font-mono font-medium">{name}</span>
									{tool.description ? (
										<span className="text-muted-foreground">
											{" "}
											— {tool.description}
										</span>
									) : null}
								</li>
							))}
						</ul>
					</ContextSection>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

function ContextSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<div className="space-y-1 border-t pt-1.5 first:border-t-0 first:pt-0">
			<p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</p>
			{children}
		</div>
	);
}

function TokenLine({
	label,
	last,
	session,
}: {
	label: string;
	last: number | null;
	session: number | null;
}) {
	const showSession =
		session != null && last != null && session !== last;

	return (
		<div className="flex items-baseline justify-between gap-2">
			<span className="shrink-0 text-muted-foreground">{label}</span>
			<span className="truncate text-right tabular-nums">
				<span className="font-medium">{formatTokenValue(last)}</span>
				{showSession ? (
					<span className="text-muted-foreground">
						{" "}
						· sessão {formatTokenNumber(session)}
					</span>
				) : null}
			</span>
		</div>
	);
}

function ContextRow({
	label,
	value,
	mono = false,
	multiline = false,
	highlight = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
	multiline?: boolean;
	highlight?: boolean;
}) {
	return (
		<div className="grid grid-cols-[4.25rem_1fr] gap-x-1.5">
			<dt className="text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					multiline
						? "break-words whitespace-pre-wrap"
						: mono
							? "truncate font-mono"
							: "truncate",
					highlight && "font-medium text-amber-600 dark:text-amber-400",
				)}
				title={value}
			>
				{value}
			</dd>
		</div>
	);
}

function formatTokenNumber(value: number): string {
	return value.toLocaleString("pt-BR");
}

function formatTokenValue(value: number | null): string {
	return value == null ? "—" : formatTokenNumber(value);
}

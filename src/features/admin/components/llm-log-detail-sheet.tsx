import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LLMLogStatus } from "@/db/queries/types";
import { getLlmLog } from "@/server-functions/llm-logs";

interface LlmLogDetailSheetProps {
	logId: number | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function LlmLogDetailSheet({
	logId,
	open,
	onOpenChange,
}: LlmLogDetailSheetProps) {
	const {
		data: log,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["llm-log", logId],
		queryFn: () => getLlmLog({ data: { id: logId as number } }),
		enabled: open && logId != null,
	});

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-2xl"
			>
				<SheetHeader className="shrink-0 border-b pb-3">
					<SheetTitle className="truncate">
						{log?.call_type ?? "LLM Log"}
					</SheetTitle>
					<SheetDescription className="truncate">
						{log
							? `${log.provider} · ${log.model}`
							: logId != null
								? `Log #${logId}`
								: ""}
					</SheetDescription>
				</SheetHeader>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pt-3">
					{isLoading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : isError || !log ? (
						<p className="text-sm text-destructive">
							Failed to load log details.
						</p>
					) : (
						<>
							<dl className="mb-4 grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 text-xs">
								<MetadataItem label="Status">
									<StatusBadge status={log.status} />
								</MetadataItem>
								<MetadataItem label="Created">
									{formatDateTime(log.created_at)}
								</MetadataItem>
								<MetadataItem label="Duration">
									{log.duration_ms != null ? `${log.duration_ms} ms` : "—"}
								</MetadataItem>
								<MetadataItem label="Tokens">
									{formatTokenMeta(log.token_meta)}
								</MetadataItem>
								<MetadataItem label="Call ID" className="col-span-2">
									<span className="break-all font-mono text-[0.65rem]">
										{log.call_id}
									</span>
								</MetadataItem>
								{log.error_message ? (
									<MetadataItem label="Error" className="col-span-2">
										<span className="text-destructive">
											{log.error_message}
										</span>
									</MetadataItem>
								) : null}
							</dl>

							<Tabs
								defaultValue="request"
								className="flex min-h-0 flex-1 flex-col overflow-hidden"
							>
								<TabsList className="mb-2 shrink-0">
									<TabsTrigger value="request">Request</TabsTrigger>
									<TabsTrigger value="response">Response</TabsTrigger>
									<TabsTrigger value="system">System prompt</TabsTrigger>
								</TabsList>

								<TabsContent
									value="request"
									className="min-h-0 flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col"
								>
									<JsonBlock value={log.request_payload} />
								</TabsContent>
								<TabsContent
									value="response"
									className="min-h-0 flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col"
								>
									<JsonBlock value={log.response_payload} />
								</TabsContent>
								<TabsContent
									value="system"
									className="min-h-0 flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col"
								>
									<JsonBlock value={log.system_prompt} plainText />
								</TabsContent>
							</Tabs>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function MetadataItem({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="mt-0.5 font-medium">{children}</dd>
		</div>
	);
}

function StatusBadge({ status }: { status: LLMLogStatus }) {
	const variantMap: Record<
		LLMLogStatus,
		"default" | "secondary" | "destructive" | "outline"
	> = {
		pending: "secondary",
		success: "outline",
		failed: "destructive",
		cancelled: "secondary",
	};

	return <Badge variant={variantMap[status]}>{status}</Badge>;
}

function JsonBlock({
	value,
	plainText = false,
}: {
	value: string | null;
	plainText?: boolean;
}) {
	if (!value) {
		return (
			<p className="text-xs text-muted-foreground">No content recorded.</p>
		);
	}

	const formatted = plainText ? value : formatJsonPayload(value);

	return (
		<pre className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
			{formatted}
		</pre>
	);
}

function formatJsonPayload(value: string): string {
	try {
		return JSON.stringify(JSON.parse(value), null, 2);
	} catch {
		return value;
	}
}

function formatDateTime(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
}

function formatTokenMeta(tokenMeta: string | null): string {
	if (!tokenMeta) return "—";
	try {
		const parsed = JSON.parse(tokenMeta) as {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
		};
		const input = parsed.inputTokens ?? 0;
		const output = parsed.outputTokens ?? 0;
		const total = parsed.totalTokens ?? input + output;
		return `${total} (${input} in / ${output} out)`;
	} catch {
		return "—";
	}
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { LLMLogStatus } from "@/db/queries/types";
import { formatDisplayTokens } from "@/features/ai/lib/format-display-tokens";
import { listLlmLogs } from "@/server-functions/llm-logs";
import { LlmLogDetailSheet } from "./llm-log-detail-sheet";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: "all" | LLMLogStatus; label: string }> = [
	{ value: "all", label: "All statuses" },
	{ value: "pending", label: "Pending" },
	{ value: "success", label: "Success" },
	{ value: "failed", label: "Failed" },
	{ value: "cancelled", label: "Cancelled" },
];

const CALL_TYPE_OPTIONS = [
	{ value: "all", label: "All call types" },
	{ value: "chat", label: "chat" },
	{ value: "connection-test", label: "connection-test" },
	{ value: "model-benchmark", label: "model-benchmark" },
	{ value: "generate-json-stream", label: "generate-json-stream" },
	{ value: "quiz.generate", label: "quiz.generate" },
	{ value: "ingest.extraction", label: "ingest.extraction" },
	{ value: "ingest.review", label: "ingest.review" },
	{ value: "reviewer.draft", label: "reviewer.draft" },
	{ value: "reviewer.arbiter", label: "reviewer.arbiter" },
] as const;

export function LlmLogsPage() {
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<"all" | LLMLogStatus>("all");
	const [callTypeFilter, setCallTypeFilter] = useState<string>("all");
	const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);

	const status = statusFilter === "all" ? undefined : statusFilter;
	const callType = callTypeFilter === "all" ? undefined : callTypeFilter;

	const { data } = useSuspenseQuery({
		queryKey: ["llm-logs", page, PAGE_SIZE, status, callType],
		queryFn: () =>
			listLlmLogs({
				data: {
					page,
					pageSize: PAGE_SIZE,
					status,
					callType,
				},
			}),
	});

	const { items, pagination } = data;

	function handleRowClick(logId: number) {
		setSelectedLogId(logId);
		setSheetOpen(true);
	}

	function handleStatusChange(value: string) {
		setStatusFilter(value as "all" | LLMLogStatus);
		setPage(1);
	}

	function handleCallTypeChange(value: string) {
		setCallTypeFilter(value);
		setPage(1);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
			<div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">LLM Logs</h2>
					<p className="text-xs text-muted-foreground">
						D1 records from AI calls when logging is enabled.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Select value={statusFilter} onValueChange={handleStatusChange}>
						<SelectTrigger className="h-8 w-[140px] text-xs">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							{STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={callTypeFilter} onValueChange={handleCallTypeChange}>
						<SelectTrigger className="h-8 w-[180px] text-xs">
							<SelectValue placeholder="Call type" />
						</SelectTrigger>
						<SelectContent>
							{CALL_TYPE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<CardHeader className="shrink-0 pb-2">
					<CardTitle className="text-sm font-medium">
						{pagination.totalItems}{" "}
						{pagination.totalItems === 1 ? "record" : "records"}
					</CardTitle>
				</CardHeader>
				<CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
					{items.length === 0 ? (
						<div className="px-4 pb-4 text-sm text-muted-foreground">
							No LLM logs found. Enable{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">
								AI_LOG_LLM=true
							</code>{" "}
							in{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code>{" "}
							to record AI calls.
						</div>
					) : (
						<>
							<div className="min-h-0 flex-1 overflow-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Date / time</TableHead>
											<TableHead>Call type</TableHead>
											<TableHead>Provider</TableHead>
											<TableHead>Model</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Duration</TableHead>
											<TableHead className="text-right">Tokens</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{items.map((log) => (
											<TableRow
												key={log.id}
												className="cursor-pointer"
												onClick={() => handleRowClick(log.id)}
											>
												<TableCell className="whitespace-nowrap text-xs">
													{formatDateTime(log.created_at)}
												</TableCell>
												<TableCell className="max-w-[140px] truncate text-xs font-mono">
													{log.call_type}
												</TableCell>
												<TableCell className="text-xs">
													{log.provider}
												</TableCell>
												<TableCell className="max-w-[120px] truncate text-xs">
													{log.model}
												</TableCell>
												<TableCell>
													<StatusBadge status={log.status} />
												</TableCell>
												<TableCell className="text-right text-xs tabular-nums">
													{log.duration_ms != null
														? `${log.duration_ms} ms`
														: "—"}
												</TableCell>
												<TableCell className="text-right text-xs tabular-nums">
													{formatTokenSummary(log.token_meta)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							<div className="flex shrink-0 items-center justify-between border-t px-4 py-3">
								<p className="text-xs text-muted-foreground">
									Page {pagination.page} of {pagination.totalPages || 1}
								</p>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 text-xs"
										disabled={!pagination.hasPrevPage}
										onClick={() =>
											setPage((current) => Math.max(1, current - 1))
										}
									>
										Previous
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 text-xs"
										disabled={!pagination.hasNextPage}
										onClick={() => setPage((current) => current + 1)}
									>
										Next
									</Button>
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			<LlmLogDetailSheet
				logId={selectedLogId}
				open={sheetOpen}
				onOpenChange={setSheetOpen}
			/>
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

	return (
		<Badge variant={variantMap[status]} className="text-[0.625rem]">
			{status}
		</Badge>
	);
}

function formatDateTime(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString();
}

function formatTokenSummary(tokenMeta: string | null): string {
	if (!tokenMeta) return "—";
	try {
		const parsed = JSON.parse(tokenMeta) as {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
		};
		const total =
			parsed.totalTokens ??
			(parsed.inputTokens ?? 0) + (parsed.outputTokens ?? 0);
		return formatDisplayTokens(total);
	} catch {
		return "—";
	}
}

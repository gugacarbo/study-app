"use client";

import { Suspense, useCallback, useState } from "react";
import {
	ActivityIcon,
	CheckCircle2Icon,
	ClockIcon,
	XCircleIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LlmLogsFilters } from "@/features/admin/components/logs/llm-logs-filters";
import { LlmLogDetail } from "@/features/admin/components/logs/llm-log-detail";
import { LogsStatsCards, type StatCard } from "@/features/admin/components/logs/logs-stats-cards";
import { LogsTimeChart } from "@/features/admin/components/logs/logs-time-chart";
import { LogsTable, type Column, type TableFilter } from "@/features/admin/components/logs/logs-table";
import { useLlmLogsList, useLlmLogsStats, useLlmLogsTimeSeries, useLlmLogDetail } from "@/features/admin/hooks/use-admin-llm-logs";
import { useLogsUsers } from "@/features/admin/hooks/use-admin-logs-users";
import type { LlmLogsListFilters } from "@/db/queries/llm-logs-admin";

function AdminLlmLogsPageSkeleton() {
	return (
		<div className="space-y-4 p-6">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="rounded-xl border p-4">
						<div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
						<div className="h-7 w-16 animate-pulse rounded bg-muted" />
					</div>
				))}
			</div>
			<div className="aspect-video animate-pulse rounded-xl bg-muted" />
			<div className="flex flex-wrap gap-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-8 w-24" />
				))}
			</div>
			<Skeleton className="h-64 w-full" />
		</div>
	);
}

function AdminLlmLogsPageContent() {
	const [filters, setFilters] = useState<LlmLogsListFilters>({});
	const [granularity, setGranularity] = useState<"hour" | "day">("day");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);

	const usersQuery = useLogsUsers();
	const statsQuery = useLlmLogsStats(filters);
	const timeSeriesQuery = useLlmLogsTimeSeries(granularity, filters);
	const listQuery = useLlmLogsList(page, pageSize, filters);
	const detailQuery = useLlmLogDetail(selectedLogId);

	const users = usersQuery.data ?? [];

	function handleFiltersChange(newFilters: LlmLogsListFilters) {
		setFilters(newFilters);
		setPage(1);
	}

	const handleRowClick = useCallback(
		(row: Record<string, unknown>) => {
			setSelectedLogId(String(row.id));
			setDetailOpen(true);
		},
		[],
	);

	const cards: StatCard[] = [
		{
			label: "Total",
			value: statsQuery.data?.total ?? 0,
			icon: ActivityIcon,
		},
		{
			label: "Sucesso",
			value: statsQuery.data?.success ?? 0,
			icon: CheckCircle2Icon,
			variant: "success",
		},
		{
			label: "Erros",
			value: statsQuery.data?.error ?? 0,
			icon: XCircleIcon,
			variant: "error",
		},
		{
			label: "Média (ms)",
			value: statsQuery.data?.avgDurationMs != null
				? Math.round(statsQuery.data.avgDurationMs)
				: "—",
			icon: ClockIcon,
		},
	];

	const columns: Column[] = [
		{ key: "createdAt", header: "Data", width: "160px" },
		{ key: "provider", header: "Provider", width: "100px" },
		{ key: "model", header: "Modelo", width: "120px" },
		{ key: "callType", header: "Tipo", width: "100px" },
		{
			key: "status",
			header: "Status",
			width: "100px",
			render: (v) => {
				const status = String(v ?? "");
				const variant =
					status === "success"
						? "default"
						: status === "error"
							? "destructive"
							: "secondary";
				const label =
					status === "success"
						? "Sucesso"
						: status === "error"
							? "Erro"
							: status === "pending"
								? "Pendente"
								: status;
				return <Badge variant={variant}>{label}</Badge>;
			},
		},
		{
			key: "durationMs",
			header: "Duração",
			width: "80px",
			render: (v) => (v != null ? `${Number(v)}ms` : "—"),
		},
		{
			key: "inputTokens",
			header: "Input tokens",
			width: "100px",
			render: (v) => (v != null ? Number(v).toLocaleString("pt-BR") : "—"),
		},
		{
			key: "outputTokens",
			header: "Output tokens",
			width: "100px",
			render: (v) => (v != null ? Number(v).toLocaleString("pt-BR") : "—"),
		},
		{
			key: "totalTokens",
			header: "Total tokens",
			width: "100px",
			render: (v) => (v != null ? Number(v).toLocaleString("pt-BR") : "—"),
		},
		{
			key: "cost",
			header: "Custo",
			width: "100px",
			render: (v) => {
				if (v == null) return <span className="text-muted-foreground">—</span>;
				return (
					<span className="tabular-nums">
						{`US$ ${Number(v).toLocaleString("en-US", {
							minimumFractionDigits: 2,
							maximumFractionDigits: 6,
						})}`}
					</span>
				);
			},
		},
		{ key: "errorMessage", header: "Erro", width: "200px" },
	];

	const tableFilters: TableFilter[] = [
		{
			key: "status",
			label: "Status",
			type: "select",
			options: [
				{ value: "pending", label: "Pendente" },
				{ value: "success", label: "Sucesso" },
				{ value: "error", label: "Erro" },
			],
		},
		{ key: "provider", label: "Provider", type: "text" },
		{ key: "model", label: "Modelo", type: "text" },
		{ key: "callType", label: "Tipo", type: "text" },
		{
			key: "userId",
			label: "Usuário",
			type: "select",
			options: users.map((u) => ({ value: u.id, label: u.email })),
		},
		{ key: "dateFrom", label: "De", type: "date" },
		{ key: "dateTo", label: "Até", type: "date" },
	];

	const filterValues: Record<string, string | undefined> = {
		...(filters.status ? { status: filters.status } : {}),
		...(filters.provider ? { provider: filters.provider } : {}),
		...(filters.model ? { model: filters.model } : {}),
		...(filters.callType ? { callType: filters.callType } : {}),
		...(filters.userId ? { userId: filters.userId } : {}),
		...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
		...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
	};

	function handleTableFilterChange(key: string, value: string | undefined) {
		setFilters((prev) => ({ ...prev, [key]: value }));
		setPage(1);
	}

	return (
		<div className="space-y-3 p-4">
			<LogsStatsCards cards={cards} isLoading={statsQuery.isLoading} />

			<LogsTimeChart
				data={timeSeriesQuery.data ?? []}
				granularity={granularity}
				onGranularityChange={(g) => {
					setGranularity(g);
					setPage(1);
				}}
				isLoading={timeSeriesQuery.isLoading}
			/>

			<LlmLogsFilters
				filters={filters}
				onFiltersChange={handleFiltersChange}
				users={users}
			/>

			<LogsTable
				columns={columns}
				data={(listQuery.data?.rows ?? []) as Array<Record<string, unknown>>}
				total={listQuery.data?.total ?? 0}
				page={page}
				pageSize={pageSize}
				onPageChange={setPage}
				onPageSizeChange={(s) => {
					setPageSize(s);
					setPage(1);
				}}
				filters={tableFilters}
				filterValues={filterValues}
				onFilterChange={handleTableFilterChange}
				onRowClick={handleRowClick}
				isLoading={listQuery.isLoading}
			/>

			<LlmLogDetail
				log={detailQuery.data as Record<string, unknown> | null}
				open={detailOpen}
				onOpenChange={(open) => {
					setDetailOpen(open);
					if (!open) setSelectedLogId(null);
				}}
				isLoading={detailQuery.isLoading}
			/>
		</div>
	);
}

export function AdminLlmLogsPage() {
	return (
		<Suspense fallback={<AdminLlmLogsPageSkeleton />}>
			<AdminLlmLogsPageContent />
		</Suspense>
	);
}

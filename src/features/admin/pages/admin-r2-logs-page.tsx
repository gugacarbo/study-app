"use client";

import { Suspense, useMemo, useState } from "react";
import {
	ActivityIcon,
	CheckCircle2Icon,
	HardDriveIcon,
	XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
	LogsStatsCards,
	type StatCard,
} from "@/features/admin/components/logs/logs-stats-cards";
import { LogsTimeChart } from "@/features/admin/components/logs/logs-time-chart";
import {
	LogsTable,
	type Column,
} from "@/features/admin/components/logs/logs-table";
import { R2LogDetail } from "@/features/admin/components/logs/r2-log-detail";
import { R2LogsFilters } from "@/features/admin/components/logs/r2-logs-filters";
import {
	useAdminR2Logs,
	type AdminR2LogsFilterState,
} from "@/features/admin/hooks/use-admin-r2-logs";
import { useLogsUsers } from "@/features/admin/hooks/use-admin-logs-users";
import { useR2LogDetail } from "@/features/admin/hooks/use-admin-r2-logs";
import type { R2LogsListFilters } from "@/db/queries/r2-logs-admin";

const PAGE_SIZE = 25;

const OPERATION_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
	get: "default",
	put: "default",
	delete: "destructive",
	head: "secondary",
	list: "secondary",
};

function formatBytes(n: number | null): string {
	if (n == null) return "—";
	if (n === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
	const value = n / Math.pow(1024, i);
	return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function AdminR2LogsPageSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-24 rounded-xl" />
				))}
			</div>
			<Skeleton className="aspect-video rounded-xl" />
			<Skeleton className="h-64 w-full rounded-xl" />
		</div>
	);
}

function AdminR2LogsPageContent() {
	const { data: users } = useLogsUsers();

	const [filters, setFilters] = useState<R2LogsListFilters>({});
	const [page, setPage] = useState(1);
	const [pageSize] = useState(PAGE_SIZE);
	const [granularity, setGranularity] = useState<"hour" | "day">("hour");
	const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);

	const filterState: AdminR2LogsFilterState = useMemo(
		() => ({ filters, page, pageSize, granularity }),
		[filters, page, pageSize, granularity],
	);

	const { stats, timeSeries, list } = useAdminR2Logs(filterState);
	const detail = useR2LogDetail(selectedLogId);

	function handleRowClick(row: Record<string, unknown>) {
		setSelectedLogId(row.id as string);
		setDetailOpen(true);
	}

	const statsCards: StatCard[] = useMemo(
		() => [
			{
				label: "Total",
				value: stats.data?.total ?? 0,
				icon: ActivityIcon,
			},
			{
				label: "Sucessos",
				value: stats.data?.success ?? 0,
				icon: CheckCircle2Icon,
				variant: "success",
			},
			{
				label: "Erros",
				value: stats.data?.error ?? 0,
				icon: XCircleIcon,
				variant: "error",
			},
			{
				label: "Total em Bytes",
				value: formatBytes(stats.data?.totalBytes ?? null),
				icon: HardDriveIcon,
			},
		],
		[stats.data],
	);

	const columns: Column[] = useMemo(
		() => [
			{
				key: "createdAt",
				header: "Data",
				width: "160px",
				render: (value) => {
					if (!value) return "—";
					const date = new Date(String(value));
					if (Number.isNaN(date.getTime())) return String(value);
					return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
				},
			},
			{ key: "bucket", header: "Bucket", width: "120px" },
			{
				key: "operation",
				header: "Operação",
				width: "100px",
				render: (value) => {
					const op = String(value ?? "").toUpperCase();
					const variant = OPERATION_VARIANTS[String(value ?? "")] ?? "default";
					return <Badge variant={variant}>{op}</Badge>;
				},
			},
			{ key: "objectKey", header: "Objeto", width: "200px" },
			{
				key: "bytes",
				header: "Bytes",
				width: "80px",
				render: (value) => formatBytes(value != null ? Number(value) : null),
			},
			{
				key: "status",
				header: "Status",
				width: "100px",
				render: (value) => {
					const status = String(value ?? "");
					const variant = status === "success" ? "default" : "destructive";
					return <Badge variant={variant}>{status}</Badge>;
				},
			},
			{
				key: "durationMs",
				header: "Duração",
				width: "80px",
				render: (value) => (value != null ? `${value}ms` : "—"),
			},
		],
		[],
	);

	const tableData = list.data?.rows ?? [];

	return (
		<div className="space-y-3">
			<LogsStatsCards cards={statsCards} isLoading={stats.isLoading} />

			<R2LogsFilters
				filters={filters}
				onFiltersChange={(newFilters) => {
					setFilters(newFilters);
					setPage(1);
				}}
				users={users}
			/>

			<LogsTimeChart
				data={timeSeries.data ?? []}
				granularity={granularity}
				onGranularityChange={(g) => {
					setGranularity(g);
				}}
				isLoading={timeSeries.isLoading}
			/>

			<LogsTable
				columns={columns}
				data={tableData}
				total={list.data?.total ?? 0}
				page={page}
				pageSize={pageSize}
				onPageChange={setPage}
				onPageSizeChange={() => {}}
				filters={[]}
				filterValues={{}}
				onFilterChange={() => {}}
				onRowClick={handleRowClick}
			/>

			<R2LogDetail
				log={(detail.data as Record<string, unknown>) ?? null}
				open={detailOpen}
				onOpenChange={(open) => {
					setDetailOpen(open);
					if (!open) setSelectedLogId(null);
				}}
				isLoading={detail.isLoading}
			/>
		</div>
	);
}

export function AdminR2LogsPage() {
	return (
		<Suspense fallback={<AdminR2LogsPageSkeleton />}>
			<AdminR2LogsPageContent />
		</Suspense>
	);
}

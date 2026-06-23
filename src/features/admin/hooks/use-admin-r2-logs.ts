import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getR2LogsStats } from "@/functions/admin/r2-logs-stats";
import { getR2LogsTimeSeries } from "@/functions/admin/r2-logs-time-series";
import { listR2Logs, getR2LogDetail } from "@/functions/admin/r2-logs-list";
import type { R2LogsListFilters } from "@/db/queries/r2-logs-admin";

export const ADMIN_R2_LOGS_KEY = ["admin", "r2-logs"] as const;

export interface AdminR2LogsFilterState {
	filters: R2LogsListFilters;
	page: number;
	pageSize: number;
	granularity: "hour" | "day";
}

export function useR2LogsStats(filters: R2LogsListFilters) {
	return useQuery({
		queryKey: [...ADMIN_R2_LOGS_KEY, "stats", filters] as const,
		queryFn: () => getR2LogsStats({ data: { filters } }),
	});
}

export function useR2LogsTimeSeries(
	granularity: "hour" | "day",
	filters: R2LogsListFilters,
) {
	return useQuery({
		queryKey: [
			...ADMIN_R2_LOGS_KEY,
			"time-series",
			granularity,
			filters,
		] as const,
		queryFn: () => getR2LogsTimeSeries({ data: { granularity, filters } }),
	});
}

export function useR2LogsList(
	page: number,
	pageSize: number,
	filters: R2LogsListFilters,
) {
	return useSuspenseQuery({
		queryKey: [...ADMIN_R2_LOGS_KEY, "list", page, pageSize, filters] as const,
		queryFn: () => listR2Logs({ data: { page, pageSize, filters } }),
	});
}

export function useR2LogDetail(id: string | null) {
	return useQuery({
		queryKey: id
			? ([...ADMIN_R2_LOGS_KEY, "detail", id] as const)
			: ([...ADMIN_R2_LOGS_KEY, "detail", "none"] as const),
		queryFn: () => {
			if (!id) throw new Error("id required");
			return getR2LogDetail({ data: { id } });
		},
		enabled: id != null,
	});
}

export function useAdminR2Logs(filterState: AdminR2LogsFilterState) {
	const stats = useR2LogsStats(filterState.filters);
	const timeSeries = useR2LogsTimeSeries(
		filterState.granularity,
		filterState.filters,
	);
	const list = useR2LogsList(
		filterState.page,
		filterState.pageSize,
		filterState.filters,
	);

	return { stats, timeSeries, list };
}

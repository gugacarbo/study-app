import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getLlmLogsStats } from "@/functions/admin/llm-logs-stats";
import { getLlmLogsTimeSeries } from "@/functions/admin/llm-logs-time-series";
import { listLlmLogs, getLlmLogDetail } from "@/functions/admin/llm-logs-list";
import type {
	LlmLogsListFilters,
} from "@/db/queries/llm-logs-admin";

export const ADMIN_LLM_LOGS_KEY = ["admin", "llm-logs"] as const;

export interface AdminLlmLogsFilterState {
	filters: LlmLogsListFilters;
	page: number;
	pageSize: number;
	granularity: "hour" | "day";
}

export function useLlmLogsStats(filters: LlmLogsListFilters) {
	return useQuery({
		queryKey: [...ADMIN_LLM_LOGS_KEY, "stats", filters] as const,
		queryFn: () => getLlmLogsStats({ data: { filters } }),
	});
}

export function useLlmLogsTimeSeries(
	granularity: "hour" | "day",
	filters: LlmLogsListFilters,
) {
	return useQuery({
		queryKey: [
			...ADMIN_LLM_LOGS_KEY,
			"time-series",
			granularity,
			filters,
		] as const,
		queryFn: () => getLlmLogsTimeSeries({ data: { granularity, filters } }),
	});
}

export function useLlmLogsList(
	page: number,
	pageSize: number,
	filters: LlmLogsListFilters,
) {
	return useSuspenseQuery({
		queryKey: [...ADMIN_LLM_LOGS_KEY, "list", page, pageSize, filters] as const,
		queryFn: () => listLlmLogs({ data: { page, pageSize, filters } }),
	});
}

export function useLlmLogDetail(id: string | null) {
	return useQuery({
		queryKey: id
			? ([...ADMIN_LLM_LOGS_KEY, "detail", id] as const)
			: ([...ADMIN_LLM_LOGS_KEY, "detail", "none"] as const),
		queryFn: () => {
			if (!id) throw new Error("id required");
			return getLlmLogDetail({ data: { id } });
		},
		enabled: id != null,
	});
}

export function useAdminLlmLogs(filterState: AdminLlmLogsFilterState) {
	const stats = useLlmLogsStats(filterState.filters);
	const timeSeries = useLlmLogsTimeSeries(
		filterState.granularity,
		filterState.filters,
	);
	const list = useLlmLogsList(
		filterState.page,
		filterState.pageSize,
		filterState.filters,
	);

	return { stats, timeSeries, list };
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { getLogsUsers } from "@/functions/admin/logs-users";

export const ADMIN_LOGS_USERS_KEY = ["admin", "logs", "users"] as const;

export type LogsUser = Awaited<ReturnType<typeof getLogsUsers>>[number];

export function useLogsUsers() {
	return useSuspenseQuery({
		queryKey: ADMIN_LOGS_USERS_KEY,
		queryFn: () => getLogsUsers(),
	});
}

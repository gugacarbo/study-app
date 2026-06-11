import { createFileRoute } from "@tanstack/react-router";
import { ProcessLogsPage } from "@/features/admin/components/process-logs-page";

export const Route = createFileRoute("/admin/process-logs")({
	component: ProcessLogsPage,
});

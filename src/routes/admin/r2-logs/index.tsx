import { createFileRoute } from "@tanstack/react-router";
import { AdminR2LogsPage } from "@/features/admin/pages/admin-r2-logs-page";

export const Route = createFileRoute("/admin/r2-logs/")({
	component: AdminR2LogsPage,
});

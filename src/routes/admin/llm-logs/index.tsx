import { createFileRoute } from "@tanstack/react-router";
import { AdminLlmLogsPage } from "@/features/admin/pages/admin-llm-logs-page";

export const Route = createFileRoute("/admin/llm-logs/")({
	component: AdminLlmLogsPage,
});

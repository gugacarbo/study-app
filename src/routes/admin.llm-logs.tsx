import { createFileRoute } from "@tanstack/react-router";
import { LlmLogsPage } from "@/features/admin/components/llm-logs-page";

export const Route = createFileRoute("/admin/llm-logs")({
	component: LlmLogsPage,
});

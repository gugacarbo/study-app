import { createFileRoute } from "@tanstack/react-router";
import { AdminConfigPage } from "@/features/admin/pages/admin-config-page";

export const Route = createFileRoute("/admin/config/")({
	component: AdminConfigPage,
});

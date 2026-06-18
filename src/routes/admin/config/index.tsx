import { createFileRoute } from "@tanstack/react-router";
import { AdminConfigPage } from "@/features/admin/pages/admin-config-page";
import { requireAdminSession } from "@/functions/auth/require-session";

export const Route = createFileRoute("/admin/config/")({
	beforeLoad: async () => {
		await requireAdminSession();
	},
	component: AdminConfigPage,
});

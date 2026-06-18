import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersPage } from "@/features/admin/pages/admin-users-page";
import { requireAdminSession } from "@/functions/auth/require-session";

export const Route = createFileRoute("/admin/users/")({
	beforeLoad: async () => {
		await requireAdminSession();
	},
	component: AdminUsersPage,
});

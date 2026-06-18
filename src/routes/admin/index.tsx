import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireAdminSession } from "@/functions/auth/require-session";

export const Route = createFileRoute("/admin/")({
	beforeLoad: async () => {
		await requireAdminSession();
		throw redirect({ to: "/admin/config" });
	},
});

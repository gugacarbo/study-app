import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminDashboardShell } from "@/features/admin/components/admin-dashboard-shell";
import {
	getSession,
	requireAdminSession,
} from "@/functions/auth/require-session";

export const Route = createFileRoute("/admin")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session?.user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.pathname },
			});
		}

		await requireAdminSession();

		return {
			user: {
				name: session.user.name,
				email: session.user.email,
			},
		};
	},
	component: AdminLayout,
});

function AdminLayout() {
	const { user } = Route.useRouteContext();

	return (
		<AdminDashboardShell user={user}>
			<Outlet />
		</AdminDashboardShell>
	);
}

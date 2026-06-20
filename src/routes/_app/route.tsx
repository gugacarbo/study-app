import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { getAppRouteContext } from "@/functions/auth/require-session";

export const Route = createFileRoute("/_app")({
	beforeLoad: async ({ location }) => {
		const ctx = await getAppRouteContext();
		if (!ctx) {
			throw redirect({
				to: "/login",
				search: { redirect: location.pathname },
			});
		}

		return ctx;
	},
	component: AppLayout,
});

function AppLayout() {
	const { user, isAdmin } = Route.useRouteContext();

	return (
		<AppShell user={user} isAdmin={isAdmin}>
			<Outlet />
		</AppShell>
	);
}

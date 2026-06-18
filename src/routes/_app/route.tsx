import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
	component: () => <Outlet />,
});

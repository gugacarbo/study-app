import {
	createRootRoute,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import type { AppRouteContext } from "@/functions/auth/require-session";
import { DefaultNotFound, RootDocument, rootHead } from "./__root/-index";

export const Route = createRootRoute({
	head: rootHead,
	notFoundComponent: DefaultNotFound,
	shellComponent: RootDocument,
	component: RootLayout,
});

function RootLayout() {
	const appContext = useRouterState({
		select: (state) =>
			state.matches.find((match) => match.routeId === "/_app")?.context as
				| AppRouteContext
				| undefined,
	});

	if (appContext?.user) {
		return (
			<AppShell user={appContext.user} isAdmin={appContext.isAdmin}>
				<Outlet />
			</AppShell>
		);
	}

	return <Outlet />;
}

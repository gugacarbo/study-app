import { createRootRoute, Outlet } from "@tanstack/react-router";
import { DefaultNotFound, RootDocument, rootHead } from "./__root/-index";

export const Route = createRootRoute({
	head: rootHead,
	notFoundComponent: DefaultNotFound,
	shellComponent: RootDocument,
	component: () => <Outlet />,
});

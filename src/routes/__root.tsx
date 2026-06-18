import { createRootRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/functions/auth/require-session";
import { DefaultNotFound, RootDocument, rootHead } from "./__root/-index";

const PUBLIC_PREFIXES = ["/login", "/api/auth"];

function isPublicPath(pathname: string) {
	return PUBLIC_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

export const Route = createRootRoute({
	head: rootHead,
	notFoundComponent: DefaultNotFound,
	shellComponent: RootDocument,
	beforeLoad: async ({ location }) => {
		if (isPublicPath(location.pathname)) {
			return;
		}

		const session = await getSession();
		if (!session?.user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.pathname },
			});
		}
	},
});

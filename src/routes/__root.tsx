import { createRootRoute } from "@tanstack/react-router";
import { RootDocument, DefaultNotFound, rootHead } from "./__root/-index";

export { queryClient } from "./__root/-index";

export const Route = createRootRoute({
	head: rootHead,
	notFoundComponent: DefaultNotFound,
	shellComponent: RootDocument,
});

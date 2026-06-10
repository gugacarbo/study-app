import { createRootRoute } from "@tanstack/react-router";
import { DefaultNotFound, RootDocument, rootHead } from "./__root/-index";

export { queryClient } from "./__root/-index";

export const Route = createRootRoute({
	head: rootHead,
	notFoundComponent: DefaultNotFound,
	shellComponent: RootDocument,
});

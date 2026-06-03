import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import appCss from "../globals.css?url";
import { RootNav } from "./root-nav";
import { RootProviders } from "./root-providers";

export { queryClient } from "./root-providers";

function DefaultNotFound() {
	return (
		<div className="rounded-lg border border-border bg-surface p-6">
			<h1 className="text-lg font-semibold text-text">Page not found</h1>
			<p className="mt-2 text-sm text-text-muted">
				The page you requested does not exist.
			</p>
			<Link
				to="/"
				className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
			>
				Back to dashboard
			</Link>
		</div>
	);
}

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Study App" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	notFoundComponent: DefaultNotFound,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="font-sans antialiased h-dvh overflow-hidden">
				<RootProviders>
					<div className="flex h-full flex-col">
						<RootNav />
						<main className="mx-auto flex-1 overflow-y-auto px-4 py-8 max-w-5xl w-full has-[[data-fullwidth]]:flex has-[[data-fullwidth]]:flex-col has-[[data-fullwidth]]:max-w-full has-[[data-fullwidth]]:px-0 has-[[data-fullwidth]]:py-0 has-[[data-fullwidth]]:overflow-hidden has-[[data-fullwidth]]:min-h-0">
							{children}
						</main>
					</div>
					<TanStackDevtools
						config={{ position: "bottom-right" }}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
					<Scripts />
				</RootProviders>
			</body>
		</html>
	);
}

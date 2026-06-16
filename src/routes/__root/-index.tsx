import { ScriptOnce } from "@tanstack/react-router";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Link, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import appCss from "../../globals.css?url";
import { getLayoutUIScript } from "@/features/ai/stores/ui-store";
import { RootNav } from "./-nav";
import { RootProviders } from "./-providers";

export { queryClient } from "./-providers";

export function rootHead() {
	return {
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Study App" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/svg+xml", href: "/logo-icon.svg" },
			{ rel: "icon", type: "image/png", sizes: "32x32", href: "/logo192.png" },
			{ rel: "apple-touch-icon", sizes: "192x192", href: "/logo192.png" },
		],
	};
}

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

export { DefaultNotFound };

export function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="font-sans antialiased h-dvh overflow-hidden">
				<ScriptOnce>{getLayoutUIScript()}</ScriptOnce>
				<RootProviders>
					<div className="flex h-full flex-col">
						<RootNav />
						<main className="mx-auto flex-1 overflow-y-auto px-4 py-5 max-w-5xl w-full has-[[data-fullwidth]]:flex has-[[data-fullwidth]]:flex-col has-[[data-fullwidth]]:max-w-full has-[[data-fullwidth]]:px-0 has-[[data-fullwidth]]:py-0 has-[[data-fullwidth]]:overflow-hidden has-[[data-fullwidth]]:min-h-0">
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

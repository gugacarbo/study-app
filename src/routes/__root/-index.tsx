import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Link, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import appCss from "../../globals.css?url";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			retry: 1,
		},
	},
});

export function rootHead() {
	return {
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Study App" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	};
}

export function DefaultNotFound() {
	return (
		<div className="rounded-lg border border-border bg-card p-6">
			<h1 className="text-lg font-semibold">Page not found</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				The page you requested does not exist.
			</p>
			<Link
				to="/"
				className="mt-4 inline-flex text-sm font-medium text-primary"
			>
				Back home
			</Link>
		</div>
	);
}

export function RootProviders({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider defaultTheme="system" storageKey="study-app-theme">
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</ThemeProvider>
	);
}

export function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-dvh bg-background font-sans text-foreground antialiased">
				<RootProviders>{children}</RootProviders>
				<Scripts />
			</body>
		</html>
	);
}

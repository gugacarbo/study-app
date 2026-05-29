import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import appCss from "../globals.css?url";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			retry: 1,
		},
	},
});

const navItems = [
	{ to: "/", label: "Dashboard" },
	{ to: "/exams", label: "Exams" },
	{ to: "/memory", label: "Memory" },
	{ to: "/chat", label: "Chat" },
	{ to: "/config", label: "Config" },
];

function AppNav() {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="flex h-14 items-center px-6">
				<NavigationMenu>
					<NavigationMenuList>
						{navItems.map((item) => (
							<NavigationMenuItem key={item.to}>
								<NavigationMenuLink
									asChild
									active={pathname === item.to}
									className={navigationMenuTriggerStyle()}
								>
									<Link to={item.to}>{item.label}</Link>
								</NavigationMenuLink>
							</NavigationMenuItem>
						))}
					</NavigationMenuList>
				</NavigationMenu>
				<div className="ml-auto">
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
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
			<body className="font-sans antialiased wrap-anywhere">
				<ThemeProvider defaultTheme="system" storageKey="theme">
					<QueryClientProvider client={queryClient}>
						<AppNav />
						<main className="mx-auto px-4 py-8 max-w-3xl has-[[data-fullwidth]]:max-w-full has-[[data-fullwidth]]:px-0 has-[[data-fullwidth]]:py-0">{children}</main>
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
					</QueryClientProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}

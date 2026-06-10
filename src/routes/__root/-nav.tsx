import { Link, useRouterState } from "@tanstack/react-router";
import { BackgroundProcessIndicator } from "@/features/background-processes/components/process-indicator";
import { Logo } from "@/components/logo";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import ThemeToggle from "@/features/theme/components/theme-toggle";
import type { FileRoutesByTo } from "@/routeTree.gen";

const navItems = [
	{ to: "/", label: "Dashboard" },
	{ to: "/exams", label: "Exams" },
	{ to: "/memory", label: "Memory" },
	{ to: "/chat", label: "Chat" },
	{ to: "/config", label: "Config" },
] as const satisfies ReadonlyArray<{ to: keyof FileRoutesByTo; label: string }>;

export function RootNav() {
	const routerState = useRouterState();
	const pathname = routerState.location.pathname;

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="flex h-14 items-center px-6 gap-4">
				<Link
					to="/"
					className="flex h-9 shrink-0 items-center hover:opacity-80 transition-opacity"
				>
					<Logo variant="full" />
				</Link>
				<NavigationMenu className="h-9">
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
				<div className="ml-auto flex items-center gap-2">
					<BackgroundProcessIndicator />
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}

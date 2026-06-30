import { Link } from "@tanstack/react-router";
import { AppAccountMenu } from "@/components/app-account-menu";
import { AppNavDesktop } from "@/components/app-nav-desktop";
import { AppNavMobile } from "@/components/app-nav-mobile";
import type { AppShellUser } from "@/components/app-shell-types";
import { Logo } from "@/components/logo";
import { ActiveJobsIndicator } from "@/features/background-processes/components/active-jobs-indicator";

type AppHeaderProps = {
	user: AppShellUser;
	isAdmin: boolean;
	pathname: string;
	pageTitle: string;
};

export function AppHeader({
	user,
	isAdmin,
	pathname,
	pageTitle,
}: AppHeaderProps) {
	return (
		<header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4 md:px-6">
				<Link
					to="/"
					className="flex h-9 shrink-0 items-center transition-opacity hover:opacity-70"
				>
					<Logo variant="full" />
				</Link>
				<AppNavDesktop pathname={pathname} />
				<div className="ml-auto flex items-center gap-2">
					<ActiveJobsIndicator />
					<AppAccountMenu user={user} isAdmin={isAdmin} />
					<div className="md:hidden">
						<AppNavMobile pathname={pathname} />
					</div>
				</div>
			</div>
			{pageTitle ? (
				<div className="sr-only">
					<h1>{pageTitle}</h1>
				</div>
			) : null}
		</header>
	);
}

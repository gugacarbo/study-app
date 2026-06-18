import { AppAccountMenu } from "@/components/app-account-menu";
import type { AppShellUser } from "@/components/app-shell-types";
import { AppNavDesktop } from "@/components/app-nav-desktop";
import { AppNavMobile } from "@/components/app-nav-mobile";

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
		<header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
			<p className="min-w-0 truncate text-sm font-semibold">{pageTitle}</p>
			<div className="flex shrink-0 items-center gap-2">
				<AppNavDesktop pathname={pathname} />
				<AppNavMobile pathname={pathname} />
				<AppAccountMenu user={user} isAdmin={isAdmin} />
			</div>
		</header>
	);
}

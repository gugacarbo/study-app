import { useRouterState } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import type { AppShellUser } from "@/components/app-shell-types";
import { getAppPageTitle } from "@/lib/app-nav";

export type { AppShellUser } from "@/components/app-shell-types";

type AppShellProps = {
	user: AppShellUser;
	isAdmin: boolean;
	children: React.ReactNode;
};

export function AppShell({ user, isAdmin, children }: AppShellProps) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const pageTitle = getAppPageTitle(pathname);

	return (
		<div className="mx-auto flex h-dvh w-full max-w-4xl flex-col bg-background">
			<AppHeader
				user={user}
				isAdmin={isAdmin}
				pathname={pathname}
				pageTitle={pageTitle}
			/>
			<main className="flex-1 overflow-y-auto px-4 py-4">{children}</main>
		</div>
	);
}

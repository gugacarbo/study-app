import { useRouterState } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import type { AppShellUser } from "@/components/app-shell-types";
import { getAppPageTitle, isWideAppShellPath } from "@/lib/app-nav";
import { cn } from "@/lib/utils";

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
	const isWide = isWideAppShellPath(pathname);

	return (
		<div
			className={cn(
				"mx-auto flex h-dvh w-full flex-col bg-background",
				isWide ? "max-w-screen-xl" : "max-w-4xl",
			)}
		>
			<AppHeader
				user={user}
				isAdmin={isAdmin}
				pathname={pathname}
				pageTitle={pageTitle}
			/>
			<main
				className={cn(
					"flex-1 px-4 py-4",
					isWide ? "flex min-h-0 flex-col overflow-hidden" : "overflow-y-auto",
				)}
			>
				{children}
			</main>
		</div>
	);
}

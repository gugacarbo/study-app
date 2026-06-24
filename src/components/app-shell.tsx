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
		<div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
			<AppHeader
				user={user}
				isAdmin={isAdmin}
				pathname={pathname}
				pageTitle={pageTitle}
			/>
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<main
					className={cn(
						"mx-auto min-w-0 flex-1 overflow-y-auto px-4 py-5",
						isWide
							? "w-full max-w-full has-[[data-fullwidth]]:flex has-[[data-fullwidth]]:flex-col has-[[data-fullwidth]]:min-h-0 has-[[data-fullwidth]]:overflow-hidden has-[[data-fullwidth]]:px-0 has-[[data-fullwidth]]:py-0"
							: "w-full max-w-5xl",
					)}
				>
					{children}
				</main>
			</div>
		</div>
	);
}

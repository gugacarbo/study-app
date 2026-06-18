import { useRouterState } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getAdminPageTitle } from "@/lib/admin-nav";

export function AdminMainHeader() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const pageTitle = getAdminPageTitle(pathname);

	return (
		<header className="flex h-14 items-center gap-2 border-b px-4">
			<SidebarTrigger />
			<h1 className="truncate text-sm font-semibold">{pageTitle}</h1>
		</header>
	);
}

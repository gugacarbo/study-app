import { useRouterState } from "@tanstack/react-router";
import * as React from "react";
import type { AppShellUser } from "@/components/app-shell-types";
import {
	SidebarInset,
	SidebarProvider,
	useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminMainHeader } from "@/features/admin/components/admin-main-header";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import { readSidebarCookie, writeSidebarCookie } from "@/lib/sidebar-cookie";

export type AdminDashboardShellProps = {
	user: AppShellUser;
	children: React.ReactNode;
};

type AdminDashboardShellLayoutProps = AdminDashboardShellProps & {
	pathname: string;
};

function AdminDashboardShellLayout({
	user,
	children,
	pathname,
}: AdminDashboardShellLayoutProps) {
	const { setOpenMobile } = useSidebar();

	return (
		<>
			<AdminSidebar
				user={user}
				pathname={pathname}
				onNavigate={() => setOpenMobile(false)}
			/>
			<SidebarInset className="flex flex-col flex-1">
				<AdminMainHeader />
				<main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
					<div className="mx-auto w-full max-w-3xl">
						{children}
					</div>
				</main>
			</SidebarInset>
		</>
	);
}

export function AdminDashboardShell({
	user,
	children,
}: AdminDashboardShellProps) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const [sidebarOpen, setSidebarOpen] = React.useState(
		() => readSidebarCookie() === "expanded",
	);

	const handleSidebarOpenChange = (open: boolean) => {
		setSidebarOpen(open);
		writeSidebarCookie(open ? "expanded" : "collapsed");
	};

	return (
		<TooltipProvider>
			<SidebarProvider
				open={sidebarOpen}
				onOpenChange={handleSidebarOpenChange}
				className="flex min-h-dvh w-full"
			>
				<AdminDashboardShellLayout user={user} pathname={pathname}>
					{children}
				</AdminDashboardShellLayout>
			</SidebarProvider>
		</TooltipProvider>
	);
}

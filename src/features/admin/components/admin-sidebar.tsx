import type { AppShellUser } from "@/components/app-shell-types";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { AdminSidebarFooter } from "@/features/admin/components/admin-sidebar-footer";
import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav";

export type AdminSidebarProps = {
	user: AppShellUser;
	pathname: string;
	onNavigate?: () => void;
};

export function AdminSidebar({
	user,
	pathname,
	onNavigate,
}: AdminSidebarProps) {
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<div className="flex items-center gap-2 px-2 py-1">
					<span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
						Admin
					</span>
					<span
						aria-hidden
						className="hidden size-6 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground group-data-[collapsible=icon]:flex"
					>
						A
					</span>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<AdminSidebarNav pathname={pathname} onNavigate={onNavigate} />
			</SidebarContent>
			<AdminSidebarFooter user={user} />
		</Sidebar>
	);
}

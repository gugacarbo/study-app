import type { ReactNode } from "react";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "./admin-sidebar";

export function AdminLayout({ children }: { children: ReactNode }) {
	return (
		<div data-fullwidth className="flex h-full overflow-hidden">
			<SidebarProvider className="flex min-h-0 h-full">
				<AdminSidebar />
				<SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
						<SidebarTrigger />
						<h1 className="text-sm font-medium">Admin</h1>
					</header>
					<div className="flex-1 overflow-hidden p-4">{children}</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

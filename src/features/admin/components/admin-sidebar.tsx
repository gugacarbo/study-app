import { Link, useRouterState } from "@tanstack/react-router";
import { ScrollText, Settings, Terminal } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
	{ to: "/admin/config", label: "Configuration", icon: Settings },
	{ to: "/admin/llm-logs", label: "LLM Logs", icon: ScrollText },
	{ to: "/admin/process-logs", label: "Process Logs", icon: Terminal },
] as const;

export function AdminSidebar() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="border-b border-sidebar-border">
				<div className="px-2 py-2 text-sm font-semibold">Admin</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{menuItems.map((item) => {
								const Icon = item.icon;
								const isActive = pathname === item.to;

								return (
									<SidebarMenuItem key={item.to}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={item.label}
										>
											<Link to={item.to} activeProps={{ "data-active": true }}>
												<Icon />
												<span>{item.label}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}

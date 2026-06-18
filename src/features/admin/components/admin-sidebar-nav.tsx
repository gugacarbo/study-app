import { useNavigate } from "@tanstack/react-router";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ADMIN_NAV_ITEMS, type AdminNavItem } from "@/lib/admin-nav";

export type AdminSidebarNavProps = {
	pathname: string;
	onNavigate?: () => void;
};

export function AdminSidebarNav({ pathname, onNavigate }: AdminSidebarNavProps) {
	const navigate = useNavigate();

	function handleNavigate(to: AdminNavItem["to"]) {
		navigate({ to });
		onNavigate?.();
	}

	return (
		<SidebarGroup>
			<SidebarGroupContent>
				<nav aria-label="Administração" className="flex flex-col gap-1">
					<SidebarMenu>
						{ADMIN_NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const active = item.match(pathname);

							return (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton
										isActive={active}
										tooltip={item.label}
										onClick={() => handleNavigate(item.to)}
									>
										<Icon />
										<span>{item.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</nav>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

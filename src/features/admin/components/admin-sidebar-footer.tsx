import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, MoonIcon, SunIcon } from "lucide-react";
import type { AppShellUser } from "@/components/app-shell-types";
import { useTheme } from "@/components/theme-provider";
import {
	SidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AdminAccountMenu } from "@/features/admin/components/admin-account-menu";

type AdminSidebarFooterProps = {
	user: AppShellUser;
};

export function AdminSidebarFooter({ user }: AdminSidebarFooterProps) {
	const navigate = useNavigate();
	const { setTheme, theme } = useTheme();

	function handleToggleTheme() {
		setTheme(theme === "dark" ? "light" : "dark");
	}

	return (
		<SidebarFooter>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						tooltip="Voltar ao app"
						onClick={() => navigate({ to: "/" })}
					>
						<ArrowLeftIcon />
						<span>Voltar ao app</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<SidebarMenuItem>
					<SidebarMenuButton
						tooltip="Alternar tema"
						onClick={handleToggleTheme}
					>
						{theme === "dark" ? <SunIcon /> : <MoonIcon />}
						<span>Alternar tema</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<SidebarMenuItem>
					<AdminAccountMenu user={user} />
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarFooter>
	);
}

import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import type { AppShellUser } from "@/components/app-shell-types";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { getUserInitials } from "@/lib/user-display";

type AdminAccountMenuProps = {
	user: AppShellUser;
};

export function AdminAccountMenu({ user }: AdminAccountMenuProps) {
	const navigate = useNavigate();
	const initials = getUserInitials(user.name, user.email);

	async function handleSignOut() {
		await authClient.signOut();
		navigate({ to: "/login" });
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton tooltip="Conta" aria-label="Conta">
					<span className="flex size-6 items-center justify-center rounded-full border text-xs font-medium">
						{initials}
					</span>
					<span>Conta</span>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" side="top" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="font-normal">
						<div className="flex flex-col gap-1">
							<span className="truncate font-medium">{user.name}</span>
							<span className="truncate text-xs text-muted-foreground">
								{user.email}
							</span>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={handleSignOut}>
						<LogOutIcon />
						Sair
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

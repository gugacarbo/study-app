import { useNavigate } from "@tanstack/react-router";
import {
	LogOutIcon,
	MoonIcon,
	SettingsIcon,
	SunIcon,
	UserIcon,
} from "lucide-react";
import type { AppShellUser } from "@/components/app-shell-types";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { getUserInitials } from "@/lib/user-display";

type AppAccountMenuProps = {
	user: AppShellUser;
	isAdmin: boolean;
};

export function AppAccountMenu({ user, isAdmin }: AppAccountMenuProps) {
	const navigate = useNavigate();
	const { setTheme, theme } = useTheme();
	const initials = getUserInitials(user.name, user.email);

	async function handleSignOut() {
		await authClient.signOut();
		navigate({ to: "/login" });
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="gap-2 text-xs font-medium text-muted-foreground"
					aria-label="Conta"
				>
					<span className="flex h-6 w-6 items-center justify-center border border-border bg-muted text-[10px] font-semibold text-foreground">
						{initials}
					</span>
					<span className="hidden max-w-[120px] truncate md:inline">{user.name}</span>
				</Button>
			</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
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
						<DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
							<UserIcon />
							Perfil
						</DropdownMenuItem>
						{isAdmin ? (
						<DropdownMenuItem
							onSelect={() => navigate({ to: "/admin" })}
						>
							<SettingsIcon />
							Administração
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem
						onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}
					>
						{theme === "dark" ? <SunIcon /> : <MoonIcon />}
						Alternar tema
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={handleSignOut}>
						<LogOutIcon />
						Sair
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

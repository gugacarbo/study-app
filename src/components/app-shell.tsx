import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	LogOutIcon,
	MoonIcon,
	SettingsIcon,
	SunIcon,
	UserIcon,
} from "lucide-react";
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
import { useTheme } from "@/components/theme-provider";
import { APP_NAV_ITEMS, getAppPageTitle } from "@/lib/app-nav";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type AppShellUser = {
	name: string;
	email: string;
};

type AppShellProps = {
	user: AppShellUser;
	isAdmin: boolean;
	children: React.ReactNode;
};

function getUserInitials(name: string, email: string): string {
	const trimmedName = name.trim();
	if (trimmedName.length > 0) {
		const parts = trimmedName.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
		}
		return trimmedName.slice(0, 2).toUpperCase();
	}

	return email.slice(0, 2).toUpperCase();
}

export function AppShell({ user, isAdmin, children }: AppShellProps) {
	const navigate = useNavigate();
	const { setTheme, theme } = useTheme();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const pageTitle = getAppPageTitle(pathname);
	const initials = getUserInitials(user.name, user.email);

	async function handleSignOut() {
		await authClient.signOut();
		navigate({ to: "/login" });
	}

	return (
		<div className="mx-auto flex h-dvh w-full max-w-lg flex-col bg-background">
			<header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">{pageTitle}</p>
					<p className="truncate text-xs text-muted-foreground">Study App</p>
				</div>
				<div className="flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="rounded-full"
								aria-label="Conta"
							>
								<span className="text-xs font-medium">{initials}</span>
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
								<DropdownMenuItem disabled>
									<UserIcon />
									Perfil em breve
								</DropdownMenuItem>
								{isAdmin ? (
									<DropdownMenuItem
										onSelect={() => navigate({ to: "/admin/config" })}
									>
										<SettingsIcon />
										Administração
									</DropdownMenuItem>
								) : null}
								<DropdownMenuItem
									onSelect={() =>
										setTheme(theme === "dark" ? "light" : "dark")
									}
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
				</div>
			</header>

			<main className="flex-1 overflow-y-auto px-4 py-4 pb-24">{children}</main>

			<nav
				aria-label="Navegação principal"
				className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
			>
				<div className="mx-auto grid h-16 max-w-lg grid-cols-3 px-2">
					{APP_NAV_ITEMS.map((item) => {
						const active = item.match(pathname);
						const Icon = item.icon;

						return (
							<button
								key={item.to}
								type="button"
								aria-current={active ? "page" : undefined}
								onClick={() => navigate({ to: item.to })}
								className={cn(
									"flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
									active
										? "text-primary"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Icon
									className={cn(
										active ? "text-primary" : "text-muted-foreground",
									)}
								/>
								<span>{item.label}</span>
							</button>
						);
					})}
				</div>
			</nav>
		</div>
	);
}

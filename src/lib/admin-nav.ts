import type { LucideIcon } from "lucide-react";
import { BotIcon, CpuIcon, HardDriveIcon, ListTodoIcon, SettingsIcon, UsersIcon } from "lucide-react";

export type AdminNavItem = {
	to: "/admin/config" | "/admin/models" | "/admin/users" | "/admin/jobs" | "/admin/llm-logs" | "/admin/r2-logs";
	label: string;
	icon: LucideIcon;
	match: (pathname: string) => boolean;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
	{
		to: "/admin/config",
		label: "Config",
		icon: SettingsIcon,
		match: (pathname) => pathname.startsWith("/admin/config"),
	},
	{
		to: "/admin/models",
		label: "Modelos",
		icon: BotIcon,
		match: (pathname) => pathname.startsWith("/admin/models"),
	},
	{
		to: "/admin/users",
		label: "Usuários",
		icon: UsersIcon,
		match: (pathname) => pathname.startsWith("/admin/users"),
	},
	{
		to: "/admin/jobs",
		label: "Jobs",
		icon: ListTodoIcon,
		match: (pathname) => pathname.startsWith("/admin/jobs"),
	},
	{
		to: "/admin/llm-logs",
		label: "LLM Logs",
		icon: CpuIcon,
		match: (pathname) => pathname.startsWith("/admin/llm-logs"),
	},
	{
		to: "/admin/r2-logs",
		label: "R2 Logs",
		icon: HardDriveIcon,
		match: (pathname) => pathname.startsWith("/admin/r2-logs"),
	},
];

export function getAdminPageTitle(pathname: string): string {
	const item = ADMIN_NAV_ITEMS.find((navItem) => navItem.match(pathname));
	return item?.label ?? "Administração";
}

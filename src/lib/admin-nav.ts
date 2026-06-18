import type { LucideIcon } from "lucide-react";
import { ListTodoIcon, SettingsIcon, UsersIcon } from "lucide-react";

export type AdminNavItem = {
	to: "/admin/config" | "/admin/users" | "/admin/jobs";
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
];

export function getAdminPageTitle(pathname: string): string {
	const item = ADMIN_NAV_ITEMS.find((navItem) => navItem.match(pathname));
	return item?.label ?? "Administração";
}

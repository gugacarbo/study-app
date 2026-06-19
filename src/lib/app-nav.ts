import type { LucideIcon } from "lucide-react";
import { BookOpenIcon, HomeIcon, PlusCircleIcon } from "lucide-react";

export type AppNavItem = {
	to: "/" | "/exams" | "/exams/new";
	label: string;
	icon: LucideIcon;
	match: (pathname: string) => boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
	{
		to: "/",
		label: "Início",
		icon: HomeIcon,
		match: (pathname) => pathname === "/",
	},
	{
		to: "/exams",
		label: "Provas",
		icon: BookOpenIcon,
		match: (pathname) =>
			pathname === "/exams" ||
			(pathname.startsWith("/exams/") && pathname !== "/exams/new"),
	},
	{
		to: "/exams/new",
		label: "Importar",
		icon: PlusCircleIcon,
		match: (pathname) => pathname === "/exams/new",
	},
];

export function getAppPageTitle(pathname: string): string {
	if (pathname === "/") {
		return "Início";
	}
	if (pathname === "/exams/new") {
		return "Nova prova";
	}
	if (pathname.startsWith("/jobs/")) {
		return "Importação";
	}
	if (pathname === "/exams" || pathname.startsWith("/exams/")) {
		return "Provas";
	}
	return "Study App";
}

export function isWideAppShellPath(pathname: string): boolean {
	return pathname.startsWith("/jobs/");
}

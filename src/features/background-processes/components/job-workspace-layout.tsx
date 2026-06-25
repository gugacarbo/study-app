import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type JobWorkspaceLayoutProps = {
	activity: ReactNode;
	sidebar: ReactNode;
	className?: string;
	activityLabel?: string;
	sidebarLabel?: string;
};

export function JobWorkspaceLayout({
	activity,
	sidebar,
	className,
	activityLabel = "Chat do agente",
	sidebarLabel = "Progresso da importação",
}: JobWorkspaceLayoutProps) {
	return (
		<div
			className={cn(
				"flex h-full min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-6",
				className,
			)}
		>
			<section
				aria-label={activityLabel}
				className="order-2 flex min-h-64 flex-1 flex-col overflow-hidden rounded-xl border bg-card md:order-none md:min-h-0 md:basis-3/5"
			>
				{activity}
			</section>
			<section
				aria-label={sidebarLabel}
				className="order-1 flex min-h-48 flex-col overflow-hidden rounded-xl border bg-card md:order-none md:min-h-0 md:basis-2/5"
			>
				{sidebar}
			</section>
		</div>
	);
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type JobWorkspaceLayoutProps = {
	chat: ReactNode;
	progress: ReactNode;
	className?: string;
};

export function JobWorkspaceLayout({
	chat,
	progress,
	className,
}: JobWorkspaceLayoutProps) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-6",
				className,
			)}
		>
			<section
				aria-label="Chat do agente"
				className="flex min-h-64 flex-1 flex-col overflow-hidden rounded-lg border bg-card md:min-h-0 md:basis-3/5"
			>
				{chat}
			</section>
			<section
				aria-label="Progresso da importação"
				className="flex min-h-48 flex-col overflow-hidden rounded-lg border bg-card md:min-h-0 md:basis-2/5"
			>
				{progress}
			</section>
		</div>
	);
}

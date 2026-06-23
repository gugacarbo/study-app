import { cn } from "@/lib/utils";

export type StatCard = {
	label: string;
	value: string | number;
	icon: React.ComponentType<{ className?: string }>;
	variant?: "default" | "success" | "error" | "warning";
};

export type LogsStatsCardsProps = {
	cards: StatCard[];
	isLoading?: boolean;
};

const variantStyles: Record<
	NonNullable<StatCard["variant"]>,
	{ bg: string; fg: string }
> = {
	default: { bg: "bg-muted", fg: "text-muted-foreground" },
	success: { bg: "bg-success/10", fg: "text-success" },
	error: { bg: "bg-destructive/10", fg: "text-destructive" },
	warning: { bg: "bg-amber-500/10", fg: "text-amber-600 dark:text-amber-400" },
};

function SkeletonCard() {
	return (
		<div className="rounded-lg border p-3">
			<div className="mb-1 flex items-center gap-2">
				<div className="size-6 animate-pulse rounded bg-muted" />
				<div className="h-3 w-20 animate-pulse rounded bg-muted" />
			</div>
			<div className="h-5 w-12 animate-pulse rounded bg-muted" />
		</div>
	);
}

export function LogsStatsCards({ cards, isLoading }: LogsStatsCardsProps) {
	if (isLoading) {
		return (
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
			{cards.map((card) => {
				const style = variantStyles[card.variant ?? "default"];
				const Icon = card.icon;
				return (
					<div
						key={card.label}
						className="rounded-lg border p-3"
					>
						<div className="flex items-center gap-2">
							<div
								className={cn(
									"flex size-6 items-center justify-center rounded",
									style.bg,
								)}
							>
								<Icon className={cn("size-3.5", style.fg)} />
							</div>
							<span className="text-xs text-muted-foreground">
								{card.label}
							</span>
						</div>
						<span className="text-lg font-semibold tabular-nums">
							{card.value}
						</span>
					</div>
				);
			})}
		</div>
	);
}

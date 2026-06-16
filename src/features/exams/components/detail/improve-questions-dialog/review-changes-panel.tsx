import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChangeDecision } from "@/features/ai/agents/improve-questions/contracts";
import { cn } from "@/lib/utils";

export interface ReviewableChange {
	id: string;
	label: string;
	before: string;
	after: string;
	decision: ChangeDecision;
}

interface ReviewChangesPanelProps {
	changes: ReviewableChange[];
	onDecision: (id: string, decision: ChangeDecision) => void;
	onKeepAll: () => void;
	onRevertAll: () => void;
	/** Use full tab height instead of compact list. */
	expanded?: boolean;
}

function decisionBadgeClass(decision: ChangeDecision): string {
	switch (decision) {
		case "keep":
			return "border-success/50 text-success";
		case "revert":
			return "border-muted-foreground/50 text-muted-foreground";
		default:
			return "border-amber-500/50 text-amber-600 dark:text-amber-400";
	}
}

function decisionLabel(decision: ChangeDecision): string {
	switch (decision) {
		case "keep":
			return "Keep";
		case "revert":
			return "Revert";
		default:
			return "Pending";
	}
}

export function ReviewChangesPanel({
	changes,
	onDecision,
	onKeepAll,
	onRevertAll,
	expanded = false,
}: ReviewChangesPanelProps) {
	if (changes.length === 0) {
		return (
			<div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
				No changes to review.
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex flex-col gap-3",
				expanded && "min-h-0 flex-1 overflow-hidden",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Review changes
				</p>
				<div className="flex gap-1">
					<Button type="button" variant="outline" size="sm" onClick={onKeepAll}>
						Keep All
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onRevertAll}
					>
						Revert All
					</Button>
				</div>
			</div>

			<ul
				className={cn(
					"flex flex-col gap-2 overflow-y-auto",
					expanded ? "min-h-0 flex-1" : "max-h-48",
				)}
			>
				{changes.map((change) => (
					<li
						key={change.id}
						className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="min-w-0 flex-1">
							<div className="mb-1 flex items-center gap-2">
								<span className="text-sm font-medium">{change.label}</span>
								<Badge
									variant="outline"
									className={cn("text-[0.65rem]", decisionBadgeClass(change.decision))}
								>
									{decisionLabel(change.decision)}
								</Badge>
							</div>
							<div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center">
								<span className="line-clamp-2 break-words">{change.before || "—"}</span>
								<ArrowRight className="hidden size-3 shrink-0 sm:block" />
								<span className="line-clamp-2 break-words text-foreground">
									{change.after || "—"}
								</span>
							</div>
						</div>
						<div className="flex shrink-0 gap-1">
							<Button
								type="button"
								variant={change.decision === "keep" ? "default" : "outline"}
								size="sm"
								onClick={() => onDecision(change.id, "keep")}
							>
								Keep
							</Button>
							<Button
								type="button"
								variant={change.decision === "revert" ? "default" : "outline"}
								size="sm"
								onClick={() => onDecision(change.id, "revert")}
							>
								Revert
							</Button>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

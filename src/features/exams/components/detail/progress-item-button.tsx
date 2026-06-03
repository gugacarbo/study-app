import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExplanationProgressItem } from "./exam-utils";

interface ProgressItemButtonProps {
	item: ExplanationProgressItem;
	questionOrder: Map<number, number>;
	isSelected: boolean;
	canOpenDialog?: boolean;
	onSelect: (id: number) => void;
	onClick?: (item: ExplanationProgressItem) => void;
}

export function ProgressItemButton({
	item,
	questionOrder,
	isSelected,
	canOpenDialog = false,
	onSelect,
	onClick,
}: ProgressItemButtonProps) {
	const isDone = item.status === "done";
	const isClickable = isDone || canOpenDialog;

	return (
		<button
			type="button"
			disabled={!isClickable}
			className={cn(
				"w-full text-left rounded-md border border-border bg-muted px-2 py-1.5",
				isClickable ? "cursor-pointer hover:bg-card" : "cursor-default",
				isSelected && "ring-1 ring-primary/40",
			)}
			onClick={() => {
				if (isDone) onSelect(item.id);
				onClick?.(item);
			}}
		>
			<div className="flex items-start gap-1.5">
				<span className="mt-0.5 shrink-0">
					{item.status === "processing" && (
						<LoaderCircle className="size-3.5 animate-spin text-primary" />
					)}
					{item.status === "done" && (
						<CheckCircle2 className="size-3.5 text-success" />
					)}
					{item.status === "error" && (
						<AlertCircle className="size-3.5 text-error" />
					)}
					{item.status === "pending" && (
						<div className="mt-1 size-2 rounded-full bg-muted-foreground/50" />
					)}
					{item.status === "skipped" && (
						<div className="mt-1 size-2 rounded-full bg-success/60" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate text-xs font-medium text-foreground">
						Q{questionOrder.get(item.id) ?? "?"} · {item.question}
					</p>
					{item.message && (
						<p className="text-[11px] text-muted-foreground">{item.message}</p>
					)}
				</div>
			</div>
		</button>
	);
}

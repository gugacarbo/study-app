import { AlertCircle, Loader2 } from "lucide-react";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import { cn } from "@/lib/utils";

interface PipelineStatusBarProps {
	stepText?: string | null;
	error?: string | PipelineErrorState | null;
	isRunning?: boolean;
	className?: string;
}

function resolveErrorMessage(error: string | PipelineErrorState): string {
	if (typeof error === "string") return error;
	return error.message;
}

export function PipelineStatusBar({
	stepText,
	error,
	isRunning = false,
	className,
}: PipelineStatusBarProps) {
	const errorMessage = error ? resolveErrorMessage(error) : null;

	return (
		<div
			className={cn(
				"flex min-h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs",
				errorMessage && "border-destructive/30 bg-destructive/5",
				className,
			)}
		>
			{errorMessage ? (
				<AlertCircle className="size-3.5 shrink-0 text-destructive" />
			) : isRunning ? (
				<Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
			) : null}
			<span
				className={cn(
					"min-w-0 flex-1 truncate",
					errorMessage ? "text-destructive" : "text-muted-foreground",
				)}
			>
				{errorMessage ?? stepText ?? (isRunning ? "Running…" : "Idle")}
			</span>
		</div>
	);
}

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PipelineErrorState } from "@/features/ai/pipeline/types";
import { cn } from "@/lib/utils";

interface PipelineErrorBannerProps {
	error: string | PipelineErrorState | null | undefined;
	stageId?: string | null;
	onDismiss?: () => void;
	onViewLogs?: () => void;
	className?: string;
}

function resolveErrorMessage(error: string | PipelineErrorState): string {
	if (typeof error === "string") return error;
	return error.message;
}

export function PipelineErrorBanner({
	error,
	stageId,
	onDismiss,
	onViewLogs,
	className,
}: PipelineErrorBannerProps) {
	if (!error) return null;

	const message = resolveErrorMessage(error);
	const resolvedStageId =
		stageId ??
		(typeof error === "object" && "stageId" in error
			? error.stageId
			: undefined);

	return (
		<div
			role="alert"
			className={cn(
				"shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					{resolvedStageId ? (
						<div className="mb-0.5 text-[0.625rem] uppercase tracking-wide opacity-80">
							Stage: {resolvedStageId}
						</div>
					) : null}
					<div>{message}</div>
					{onViewLogs ? (
						<Button
							type="button"
							variant="link"
							size="xs"
							className="mt-1 h-auto p-0 text-destructive underline-offset-2 hover:text-destructive"
							onClick={onViewLogs}
						>
							View logs
						</Button>
					) : null}
				</div>
				{onDismiss ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="shrink-0 text-destructive hover:text-destructive"
						onClick={onDismiss}
						aria-label="Dismiss error"
					>
						<X className="size-3.5" />
					</Button>
				) : null}
			</div>
		</div>
	);
}

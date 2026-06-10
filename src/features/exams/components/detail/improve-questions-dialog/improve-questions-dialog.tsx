import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentStreamPanel } from "./agent-stream-panel";
import {
	type PanelLayout,
	PanelSplitGutter,
} from "./panel-split-gutter";
import { QuestionPreviewPanel } from "./question-preview-panel";
import { ReviewChangesPanel } from "./review-changes-panel";
import type { ImproveQuestionsDialogProps } from "./types";

function countApplicableChanges(
	changes: ImproveQuestionsDialogProps["changes"],
): number {
	return changes.filter((change) => change.decision !== "revert").length;
}

export function ImproveQuestionsDialog({
	open,
	onOpenChange,
	question,
	draftQuestion,
	messages,
	isStreaming,
	agentStatus,
	changes,
	onDecision,
	onKeepAll,
	onRevertAll,
	onApply,
	onCancel,
	applying,
}: ImproveQuestionsDialogProps) {
	const [panelLayout, setPanelLayout] = useState<PanelLayout>("balanced");
	const showReview = agentStatus === "done";
	const applyCount = countApplicableChanges(changes);
	const canApply = showReview && applyCount > 0 && !applying;
	const isRunning = agentStatus === "running" || isStreaming;

	useEffect(() => {
		if (!open) {
			setPanelLayout("balanced");
		}
	}, [open]);

	const previewActive = panelLayout !== "right";
	const agentActive = panelLayout !== "left";

	const splitGridClass = cn(
		"grid min-h-[min(50vh,28rem)] flex-1",
		"[grid-template-areas:'preview'_'gutter'_'agent']",
		"sm:[grid-template-areas:'preview_gutter_agent']",
		panelLayout === "balanced" &&
			"grid-cols-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-rows-none",
		panelLayout === "left" &&
			"grid-cols-1 grid-rows-[minmax(0,1fr)_auto_0fr] sm:grid-cols-[minmax(0,1fr)_auto_0fr] sm:grid-rows-none",
		panelLayout === "right" &&
			"grid-cols-1 grid-rows-[0fr_auto_minmax(0,1fr)] sm:grid-cols-[0fr_auto_minmax(0,1fr)] sm:grid-rows-none",
	);

	const paneShellClass =
		"flex min-h-0 min-w-0 flex-col overflow-hidden";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-6xl">
				<DialogHeader>
					<DialogTitle>Improve Question — Q{question.id}</DialogTitle>
					<DialogDescription className="line-clamp-2">
						{question.question}
					</DialogDescription>
				</DialogHeader>

				<div className={splitGridClass}>
					<div
						className={cn(
							paneShellClass,
							"[grid-area:preview]",
							previewActive
								? "opacity-100"
								: "pointer-events-none overflow-hidden",
						)}
						aria-hidden={!previewActive}
					>
						<QuestionPreviewPanel question={draftQuestion} />
					</div>

					<div className="[grid-area:gutter]">
						<PanelSplitGutter
							layout={panelLayout}
							onLayoutChange={setPanelLayout}
						/>
					</div>

					<div
						className={cn(
							paneShellClass,
							"[grid-area:agent]",
							agentActive
								? "opacity-100"
								: "pointer-events-none overflow-hidden",
						)}
						aria-hidden={!agentActive}
					>
						<AgentStreamPanel
							messages={messages}
							isStreaming={isStreaming}
							agentStatus={agentStatus}
						/>
					</div>
				</div>

				{showReview && (
					<ReviewChangesPanel
						changes={changes}
						onDecision={onDecision}
						onKeepAll={onKeepAll}
						onRevertAll={onRevertAll}
					/>
				)}

				<DialogFooter className="gap-2 sm:justify-between">
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={applying}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={onApply}
						disabled={!canApply || isRunning}
					>
						{applying ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Applying…
							</>
						) : (
							`Apply ${applyCount} change${applyCount === 1 ? "" : "s"}`
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

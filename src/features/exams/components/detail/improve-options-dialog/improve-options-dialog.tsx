import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AgentStreamPanel } from "./agent-stream-panel";
import { QuestionPreviewPanel } from "./question-preview-panel";
import { ReviewChangesPanel } from "./review-changes-panel";
import type { ImproveOptionsDialogProps } from "./types";

function countApplicableChanges(
	changes: ImproveOptionsDialogProps["changes"],
): number {
	return changes.filter((change) => change.decision !== "revert").length;
}

export function ImproveOptionsDialog({
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
}: ImproveOptionsDialogProps) {
	const showReview = agentStatus === "done";
	const applyCount = countApplicableChanges(changes);
	const canApply = showReview && applyCount > 0 && !applying;
	const isRunning = agentStatus === "running" || isStreaming;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Improve Options — Q{question.id}</DialogTitle>
					<DialogDescription className="line-clamp-2">
						{question.question}
					</DialogDescription>
				</DialogHeader>

				<div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
					<QuestionPreviewPanel question={draftQuestion} />
					<AgentStreamPanel
						messages={messages}
						isStreaming={isStreaming}
						agentStatus={agentStatus}
					/>
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

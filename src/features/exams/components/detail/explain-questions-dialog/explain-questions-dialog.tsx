import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineThread } from "@/features/ai/pipeline/ui";
import { cn } from "@/lib/utils";
import {
	type PanelLayout,
	PanelSplitGutter,
} from "../improve-questions-dialog/panel-split-gutter";
import { ReviewChangesPanel } from "../improve-questions-dialog/review-changes-panel";
import { ExplanationPreviewPanel } from "./explanation-preview-panel";
import type { ExplainQuestionsDialogProps } from "./types";

function countApplicableChanges(
	changes: ExplainQuestionsDialogProps["changes"],
): number {
	return changes.filter((change) => change.decision !== "revert").length;
}

export function ExplainQuestionsDialog({
	open,
	onOpenChange,
	question,
	preview,
	messages,
	isStreaming,
	agentStatus,
	changes,
	onDecision,
	onKeepAll,
	onRevertAll,
	onApply,
	onCancel,
	onDismiss,
	onContinue,
	canContinue,
	streamError,
	applying,
}: ExplainQuestionsDialogProps) {
	const [panelLayout, setPanelLayout] = useState<PanelLayout>("balanced");
	const [activeTab, setActiveTab] = useState<"preview" | "review">("preview");
	const showReview = agentStatus === "done";
	const hasDiff = changes.length > 0;
	const applyCount = countApplicableChanges(changes);
	const canApply = showReview && applyCount > 0 && !applying;
	const canRevert = showReview && hasDiff && !applying;
	const isRunning = agentStatus === "running" || isStreaming;
	const canDismiss = showReview && !isRunning && !applying;

	useEffect(() => {
		if (!open) {
			setPanelLayout("balanced");
			setActiveTab("preview");
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

	const paneShellClass = "flex min-h-0 min-w-0 flex-col overflow-hidden";

	const previewContent =
		showReview && hasDiff ? (
			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as "preview" | "review")}
				className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
			>
				<TabsList className="h-8 shrink-0 bg-muted">
					<TabsTrigger value="preview" className="px-3 text-[0.7rem]">
						Preview
					</TabsTrigger>
					<TabsTrigger value="review" className="px-3 text-[0.7rem]">
						Review changes
						{applyCount > 0 ? ` (${applyCount})` : ""}
					</TabsTrigger>
				</TabsList>

				<TabsContent
					value="preview"
					className="min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
				>
					<ExplanationPreviewPanel question={question} preview={preview} />
				</TabsContent>

				<TabsContent
					value="review"
					className="min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
				>
					<ReviewChangesPanel
						changes={changes}
						onDecision={onDecision}
						onKeepAll={onKeepAll}
						onRevertAll={onRevertAll}
						expanded
					/>
				</TabsContent>
			</Tabs>
		) : (
			<ExplanationPreviewPanel question={question} preview={preview} />
		);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-4 sm:max-w-6xl">
				<DialogHeader>
					<DialogTitle>Explicacoes — Q{question.id}</DialogTitle>
					<DialogDescription className="line-clamp-2">
						{question.question}
					</DialogDescription>
				</DialogHeader>

				{streamError ? (
					<div
						role="alert"
						className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						{streamError}
					</div>
				) : null}

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
						{previewContent}
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
						<PipelineThread
							messages={messages}
							isRunning={isStreaming}
							mode="readonly"
							layout="panel"
						/>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:justify-between">
					<div className="flex gap-2">
						{canDismiss ? (
							<Button
								type="button"
								variant="outline"
								onClick={onDismiss}
								disabled={applying}
							>
								Limpar execucao
							</Button>
						) : (
							<Button
								type="button"
								variant="outline"
								onClick={onCancel}
								disabled={applying || isRunning}
							>
								Cancelar
							</Button>
						)}
						{canContinue && (
							<Button
								type="button"
								variant="secondary"
								onClick={onContinue}
								disabled={applying || isRunning}
							>
								Continuar
							</Button>
						)}
					</div>
					<div className="flex gap-2">
						{showReview && hasDiff && (
							<Button
								type="button"
								variant="outline"
								onClick={onRevertAll}
								disabled={!canRevert || isRunning}
							>
								Reverter
							</Button>
						)}
						<Button
							type="button"
							onClick={onApply}
							disabled={!canApply || isRunning}
						>
							{applying ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Aplicando…
								</>
							) : (
								`Aplicar ${applyCount} mudanca${applyCount === 1 ? "" : "s"}`
							)}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

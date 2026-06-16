import type { QuestionData } from "../exam-utils";
import type { ExplanationPreview } from "./types";

interface ExplanationPreviewPanelProps {
	question: QuestionData;
	preview: ExplanationPreview;
}

export function ExplanationPreviewPanel({
	question,
	preview,
}: ExplanationPreviewPanelProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-md border border-border bg-muted/20 p-3 text-sm">
			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Question
				</p>
				<p className="whitespace-pre-wrap">{question.question}</p>
			</div>

			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Explanation
				</p>
				<p className="whitespace-pre-wrap">
					{preview.explanation.trim() || "—"}
				</p>
			</div>

			<div>
				<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Deep explanation
				</p>
				<p className="whitespace-pre-wrap">
					{preview.deepExplanation.trim() || "—"}
				</p>
			</div>
		</div>
	);
}

import type { ReactNode } from "react";
import type { QuestionData } from "../exam-utils";

interface QuestionSelectionProps {
	questions: QuestionData[];
	selectAll: boolean;
	selectedIds: Set<number>;
	disabled: boolean;
	onSelectAll: (checked: boolean) => void;
	onToggleQuestion: (questionId: number, checked: boolean) => void;
	toolbar?: ReactNode;
	footer?: ReactNode;
}

export function QuestionSelection({
	questions,
	selectAll,
	selectedIds,
	disabled,
	onSelectAll,
	onToggleQuestion,
	toolbar,
	footer,
}: QuestionSelectionProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			{toolbar ?? (
				<label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2.5">
					<input
						type="checkbox"
						checked={selectAll}
						onChange={(e) => onSelectAll(e.target.checked)}
						disabled={disabled}
						className="accent-primary"
					/>
					<span className="font-medium">Selecionar todas as questões</span>
				</label>
			)}
			<div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted p-2">
				<div className="grid grid-cols-3 gap-1.5">
					{questions.map((question, index) => (
						<label
							key={question.id}
							className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2"
						>
							<input
								type="checkbox"
								checked={selectedIds.has(question.id)}
								onChange={(e) =>
									onToggleQuestion(question.id, e.target.checked)
								}
								disabled={disabled}
								className="mt-0.5 accent-primary"
							/>
							<span className="min-w-0 flex-1 text-xs leading-relaxed">
								<span className="font-semibold text-muted-foreground">
									Q{index + 1}
								</span>{" "}
								<span className="line-clamp-2">{question.question}</span>
							</span>
						</label>
					))}
				</div>
			</div>
			{footer}
		</div>
	);
}

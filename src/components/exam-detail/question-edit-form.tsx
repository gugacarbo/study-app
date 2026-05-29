import { Save, X } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import type { QuestionData, EditFormData } from "./exam-utils";

interface QuestionEditFormProps {
	question: QuestionData;
	editForm: EditFormData;
	onSave: (id: number) => void;
	onCancel: () => void;
	onFormChange: (updates: Partial<EditFormData>) => void;
	saving: boolean;
}

export function QuestionEditForm({
	question,
	editForm,
	onSave,
	onCancel,
	onFormChange,
	saving,
}: QuestionEditFormProps) {
	return (
		<div className="mt-3 space-y-3">
			<div>
				<span className="text-xs font-semibold text-muted-foreground mb-1 block">
					Question
				</span>
				<Textarea
					value={editForm.question}
					onChange={(e) => onFormChange({ question: e.target.value })}
					className="min-h-[60px]"
				/>
			</div>

			<div>
				<span className="text-xs font-semibold text-muted-foreground mb-1 block">
					Options
				</span>
				<div className="space-y-1.5">
					{editForm.options.map((opt, optIdx) => {
						const letter = String.fromCharCode(65 + optIdx);
						return (
							<div key={optIdx} className="flex items-center gap-2">
								<input
									type="radio"
									name={`correct-${question.id}`}
									checked={editForm.answer === opt}
									onChange={() => onFormChange({ answer: opt })}
									className="shrink-0 accent-primary"
								/>
								<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
									{letter}
								</span>
								<input
									type="text"
									value={opt}
									onChange={(e) => {
										const newOptions = [...editForm.options];
										newOptions[optIdx] = e.target.value;
										onFormChange({
											options: newOptions,
											answer:
												editForm.answer === opt
													? e.target.value
													: editForm.answer,
										});
									}}
									className="flex-1 rounded-lg border border-border bg-card p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
								/>
								{editForm.options.length > 2 && (
									<button
										type="button"
										onClick={() => {
											const newOptions = editForm.options.filter(
												(_, i) => i !== optIdx,
											);
											const newAnswer =
												editForm.answer === opt
													? (newOptions[0] ?? "")
													: editForm.answer;
											onFormChange({ options: newOptions, answer: newAnswer });
										}}
										className="text-muted-foreground hover:text-destructive transition-colors"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>
						);
					})}
				</div>
				<button
					type="button"
					onClick={() => onFormChange({ options: [...editForm.options, ""] })}
					className="mt-1.5 text-xs text-primary hover:underline"
				>
					+ Add option
				</button>
			</div>

			<div>
				<span className="text-xs font-semibold text-muted-foreground mb-1 block">
					Explanation
				</span>
				<Textarea
					value={editForm.explanation}
					onChange={(e) => onFormChange({ explanation: e.target.value })}
					className="min-h-[50px]"
				/>
			</div>

			<div>
				<span className="text-xs font-semibold text-muted-foreground mb-1 block">
					Deep Explanation
				</span>
				<Textarea
					value={editForm.deepExplanation}
					onChange={(e) => onFormChange({ deepExplanation: e.target.value })}
					className="min-h-[130px]"
				/>
			</div>

			<div className="flex gap-2">
				<Button
					type="button"
					onClick={() => onSave(question.id)}
					disabled={
						saving ||
						!editForm.question ||
						editForm.options.length < 2 ||
						!editForm.answer
					}
				>
					<Save className="h-4 w-4" />
					{saving ? "Saving..." : "Save"}
				</Button>
				<Button type="button" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</div>
	);
}

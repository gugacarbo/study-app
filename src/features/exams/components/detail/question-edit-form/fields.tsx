import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EditFormData, QuestionData } from "../exam-utils";

interface QuestionEditFieldsProps {
	question: QuestionData;
	editForm: EditFormData;
	onFormChange: (updates: Partial<EditFormData>) => void;
}

export function QuestionEditFields({
	question,
	editForm,
	onFormChange,
}: QuestionEditFieldsProps) {
	return (
		<>
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
				<div className="flex flex-col gap-1.5">
					{editForm.options.map((opt, optIdx) => {
						const letter = String.fromCharCode(65 + optIdx);
						return (
							<div
								key={`${question.id}:${letter}:${opt}`}
								className="flex items-center gap-2"
							>
								<input
									type="radio"
									name={`correct-${question.id}`}
									checked={editForm.answer === opt}
									onChange={() => onFormChange({ answer: opt })}
									className="shrink-0 accent-primary"
								/>
								<span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
									{letter}
								</span>
								<Input
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
									className="flex-1"
								/>
								{editForm.options.length > 2 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
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
										className="text-muted-foreground hover:text-destructive"
									>
										<X className="size-4" />
									</Button>
								)}
							</div>
						);
					})}
				</div>
				<Button
					type="button"
					variant="link"
					size="xs"
					onClick={() => onFormChange({ options: [...editForm.options, ""] })}
					className="mt-1.5"
				>
					+ Add option
				</Button>
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
		</>
	);
}

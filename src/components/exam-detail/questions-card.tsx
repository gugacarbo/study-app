import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { EditFormData, QuestionData } from "./exam-utils";
import { QuestionAccordion } from "./question-accordion";
import { QuestionEditForm } from "./question-edit-form";

interface QuestionsCardProps {
	questions: QuestionData[];
	expandedQuestions: Set<number>;
	setExpandedQuestions: (v: Set<number>) => void;
	editingQuestionId: number | null;
	editForm: EditFormData | null;
	onStartEdit: (q: QuestionData) => void;
	onSave: (id: number) => void;
	onCancel: () => void;
	onFormChange: (updates: Partial<EditFormData>) => void;
	saving: boolean;
	toggleQuestion: (id: number) => void;
}

export function QuestionsCard({
	questions,
	expandedQuestions,
	setExpandedQuestions,
	editingQuestionId,
	editForm,
	onStartEdit,
	onSave,
	onCancel,
	onFormChange,
	saving,
	toggleQuestion,
}: QuestionsCardProps) {
	return (
		<Card className="mb-4">
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
					Questions ({questions.length})
				</CardTitle>
				<button
					type="button"
					onClick={() => {
						if (expandedQuestions.size === questions.length) {
							setExpandedQuestions(new Set());
						} else {
							setExpandedQuestions(new Set(questions.map((q) => q.id)));
						}
					}}
					className="text-xs text-primary hover:underline"
				>
					{expandedQuestions.size === questions.length
						? "Collapse all"
						: "Expand all"}
				</button>
			</CardHeader>
			<CardContent>
				{questions.length === 0 ? (
					<p className="text-sm text-muted-foreground">No questions found.</p>
				) : (
					<div className="space-y-2">
						{questions.map((q, idx) => {
							const isExpanded = expandedQuestions.has(q.id);
							const isEditing = editingQuestionId === q.id && editForm;

							return (
								<div
									key={q.id}
									className="rounded-lg border border-border overflow-hidden"
								>
									<button
										type="button"
										onClick={() => toggleQuestion(q.id)}
										className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted transition-colors"
									>
										<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
											{idx + 1}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm leading-relaxed line-clamp-2">
												{q.question}
											</p>
											{q.topic && (
												<Badge variant="secondary" className="mt-1">
													{q.topic}
												</Badge>
											)}
										</div>
										<div className="shrink-0 mt-0.5">
											{isExpanded ? (
												<ChevronUp className="h-4 w-4 text-muted-foreground" />
											) : (
												<ChevronDown className="h-4 w-4 text-muted-foreground" />
											)}
										</div>
									</button>

									{isExpanded && (
										<div className="px-3 pb-3 pt-0 border-t border-border">
											{isEditing ? (
												<QuestionEditForm
													question={q}
													editForm={editForm}
													onSave={onSave}
													onCancel={onCancel}
													onFormChange={onFormChange}
													saving={saving}
												/>
											) : (
												<QuestionAccordion
													question={q}
													index={idx}
													isExpanded={isExpanded}
													onToggle={toggleQuestion}
													onStartEdit={onStartEdit}
												/>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

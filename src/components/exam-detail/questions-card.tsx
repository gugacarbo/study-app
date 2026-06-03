import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { EditFormData, QuestionData } from "./exam-utils";
import { QuestionItem } from "./question-item";

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
		<Card>
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
					<div className="flex flex-col gap-2">
						{questions.map((q, idx) => {
							const isExpanded = expandedQuestions.has(q.id);
							const isEditing = editingQuestionId === q.id && !!editForm;

							return (
								<QuestionItem
									key={q.id}
									question={q}
									index={idx}
									isExpanded={isExpanded}
									isEditing={isEditing}
									editForm={editForm}
									onToggle={toggleQuestion}
									onStartEdit={onStartEdit}
									onSave={onSave}
									onCancel={onCancel}
									onFormChange={onFormChange}
									saving={saving}
								/>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

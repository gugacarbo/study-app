import { Accordion } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
					<Accordion
						type="multiple"
						className="flex flex-col gap-2 rounded-none border-0"
						value={Array.from(expandedQuestions).map(String)}
						onValueChange={(values) =>
							setExpandedQuestions(new Set(values.map(Number)))
						}
					>
						{questions.map((q, idx) => {
							const isEditing = editingQuestionId === q.id && !!editForm;

							return (
								<QuestionItem
									key={q.id}
									question={q}
									index={idx}
									isEditing={isEditing}
									editForm={editForm}
									onStartEdit={onStartEdit}
									onSave={onSave}
									onCancel={onCancel}
									onFormChange={onFormChange}
									saving={saving}
								/>
							);
						})}
					</Accordion>
				)}
			</CardContent>
		</Card>
	);
}

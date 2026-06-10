import { Accordion } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImproveQuestionsRunPhase } from "@/features/background-processes";
import type { EditFormData, QuestionData } from "./exam-utils";
import { QuestionItem } from "./question-item";

interface QuestionsCardProps {
	questions: QuestionData[];
	expandedQuestions: Set<number>;
	setExpandedQuestions: (v: Set<number>) => void;
	editingQuestionId: number | null;
	editForm: EditFormData | null;
	onStartEdit: (q: QuestionData) => void;
	onImproveQuestions?: (q: QuestionData) => void;
	improveQuestionsStatusByQuestionId?: Map<number, ImproveQuestionsRunPhase>;
	draftOverrideByQuestionId?: Map<number, QuestionData>;
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
	onImproveQuestions = () => {},
	improveQuestionsStatusByQuestionId = new Map(),
	draftOverrideByQuestionId = new Map(),
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
							const displayQuestion =
								draftOverrideByQuestionId.get(q.id) ?? q;
							const improveQuestionsStatus =
								improveQuestionsStatusByQuestionId.get(q.id) ?? null;

							return (
								<QuestionItem
									key={q.id}
									question={displayQuestion}
									index={idx}
									isEditing={isEditing}
									editForm={editForm}
									onStartEdit={onStartEdit}
									onImproveQuestions={onImproveQuestions}
									improveQuestionsStatus={improveQuestionsStatus}
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

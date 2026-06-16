import { Loader2, Sparkles } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
	onOpenImproveQuestionsBatch?: () => void;
	onOpenExplainQuestionsBatch?: () => void;
	explanationProcessActive?: boolean;
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
	onOpenImproveQuestionsBatch,
	onOpenExplainQuestionsBatch,
	explanationProcessActive = false,
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
			<CardHeader className="flex flex-col items-stretch gap-2.5 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
				<CardTitle className="text-sm font-semibold">
					Questions ({questions.length})
				</CardTitle>
				{(onOpenImproveQuestionsBatch || onOpenExplainQuestionsBatch) &&
					questions.length > 0 && (
						<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
							{onOpenExplainQuestionsBatch && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="min-h-10 w-full sm:min-h-8 sm:w-auto"
									onClick={onOpenExplainQuestionsBatch}
								>
									{explanationProcessActive ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<Sparkles data-icon="inline-start" />
									)}
									Gerar explicacoes
								</Button>
							)}
							{onOpenImproveQuestionsBatch && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="min-h-10 w-full sm:min-h-8 sm:w-auto"
									onClick={onOpenImproveQuestionsBatch}
								>
									<Sparkles data-icon="inline-start" />
									Melhorar questões
								</Button>
							)}
						</div>
					)}
			</CardHeader>
			<CardContent className="px-3 sm:px-4">
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
							const displayQuestion = draftOverrideByQuestionId.get(q.id) ?? q;
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

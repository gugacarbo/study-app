import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { ImproveQuestionsRunPhase } from "@/features/background-processes";
import type { EditFormData, QuestionData } from "./exam-utils";
import { QuestionAccordion } from "./question-accordion";
import { QuestionEditForm } from "./question-edit-form";

interface QuestionItemProps {
	question: QuestionData;
	index: number;
	isEditing: boolean;
	editForm: EditFormData | null;
	onStartEdit: (q: QuestionData) => void;
	onImproveQuestions: (q: QuestionData) => void;
	improveQuestionsStatus?: ImproveQuestionsRunPhase | null;
	onSave: (id: number) => void;
	onCancel: () => void;
	onFormChange: (updates: Partial<EditFormData>) => void;
	saving: boolean;
}

export function QuestionItem({
	question,
	index,
	isEditing,
	editForm,
	onStartEdit,
	onImproveQuestions,
	improveQuestionsStatus = null,
	onSave,
	onCancel,
	onFormChange,
	saving,
}: QuestionItemProps) {
	return (
		<AccordionItem
			value={String(question.id)}
			className="overflow-hidden rounded-lg border not-last:border-b"
		>
			<AccordionTrigger className="min-h-12 items-start gap-2.5 p-3 hover:bg-muted hover:no-underline sm:min-h-0 sm:gap-3">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary sm:size-6 sm:font-medium">
					{index + 1}
				</div>
				<div className="min-w-0 flex-1 text-left">
					<p className="line-clamp-3 text-sm leading-relaxed sm:line-clamp-2">
						{question.question}
					</p>
				</div>
			</AccordionTrigger>

			<AccordionContent className="border-t px-2.5 pb-3 sm:px-3">
				{isEditing && editForm ? (
					<QuestionEditForm
						question={question}
						editForm={editForm}
						onSave={onSave}
						onCancel={onCancel}
						onFormChange={onFormChange}
						saving={saving}
					/>
				) : (
					<QuestionAccordion
						question={question}
						onStartEdit={onStartEdit}
						onImproveQuestions={onImproveQuestions}
						improveQuestionsStatus={improveQuestionsStatus}
					/>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}

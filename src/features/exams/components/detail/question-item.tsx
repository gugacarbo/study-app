import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import type { EditFormData, QuestionData } from "./exam-utils";
import { QuestionAccordion } from "./question-accordion";
import { QuestionEditForm } from "./question-edit-form";

interface QuestionItemProps {
	question: QuestionData;
	index: number;
	isEditing: boolean;
	editForm: EditFormData | null;
	onStartEdit: (q: QuestionData) => void;
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
			<AccordionTrigger className="items-start gap-3 p-3 hover:bg-muted hover:no-underline">
				<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
					{index + 1}
				</div>
				<div className="min-w-0 flex-1 text-left">
					<p className="text-sm leading-relaxed line-clamp-2">
						{question.question}
					</p>
				</div>
			</AccordionTrigger>

			<AccordionContent className="border-t px-3 pb-3">
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
					<QuestionAccordion question={question} onStartEdit={onStartEdit} />
				)}
			</AccordionContent>
		</AccordionItem>
	);
}

import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "../ui/badge";
import type { EditFormData, QuestionData } from "./exam-utils";
import { QuestionAccordion } from "./question-accordion";
import { QuestionEditForm } from "./question-edit-form";

interface QuestionItemProps {
	question: QuestionData;
	index: number;
	isExpanded: boolean;
	isEditing: boolean;
	editForm: EditFormData | null;
	onToggle: (id: number) => void;
	onStartEdit: (q: QuestionData) => void;
	onSave: (id: number) => void;
	onCancel: () => void;
	onFormChange: (updates: Partial<EditFormData>) => void;
	saving: boolean;
}

export function QuestionItem({
	question,
	index,
	isExpanded,
	isEditing,
	editForm,
	onToggle,
	onStartEdit,
	onSave,
	onCancel,
	onFormChange,
	saving,
}: QuestionItemProps) {
	return (
		<div className="rounded-lg border overflow-hidden">
			<button
				type="button"
				onClick={() => onToggle(question.id)}
				className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted transition-colors"
			>
				<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
					{index + 1}
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm leading-relaxed line-clamp-2">
						{question.question}
					</p>
					{question.topic && (
						<Badge variant="secondary" className="mt-1">
							{question.topic}
						</Badge>
					)}
				</div>
				<div className="shrink-0 mt-0.5">
					{isExpanded ? (
						<ChevronUp className="size-4 text-muted-foreground" />
					) : (
						<ChevronDown className="size-4 text-muted-foreground" />
					)}
				</div>
			</button>

			{isExpanded && (
				<div className="px-3 pb-3 pt-0 border-t">
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
							index={index}
							isExpanded={isExpanded}
							onToggle={onToggle}
							onStartEdit={onStartEdit}
						/>
					)}
				</div>
			)}
		</div>
	);
}

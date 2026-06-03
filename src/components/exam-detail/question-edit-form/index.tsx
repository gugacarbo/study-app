import { Save } from "lucide-react";
import { Button } from "../../ui/button";
import type { EditFormData, QuestionData } from "../exam-utils";
import { QuestionEditFields } from "./fields";

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
		<div className="mt-3 flex flex-col gap-3">
			<QuestionEditFields
				question={question}
				editForm={editForm}
				onFormChange={onFormChange}
			/>
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
					<Save className="size-4" />
					{saving ? "Saving..." : "Save"}
				</Button>
				<Button type="button" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</div>
	);
}

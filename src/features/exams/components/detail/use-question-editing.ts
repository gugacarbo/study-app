import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { updateQuestion } from "@/server-functions/exams";
import type { EditFormData, QuestionData } from "./exam-utils";

interface UseQuestionEditingProps {
	examId: number;
}

export function useQuestionEditing({ examId }: UseQuestionEditingProps) {
	const queryClient = useQueryClient();
	const [editingQuestionId, setEditingQuestionId] = useState<number | null>(
		null,
	);
	const [editForm, setEditForm] = useState<EditFormData | null>(null);
	const [saving, setSaving] = useState(false);

	const startEditing = (q: QuestionData) => {
		setEditingQuestionId(q.id);
		setEditForm({
			question: q.question,
			options: [...q.options],
			answers: [...q.answers],
			scoringMode: q.scoringMode,
			explanation: q.explanation || "",
			deepExplanation: q.deepExplanation || "",
			topic: q.topic || "",
		});
	};

	const cancelEditing = () => {
		setEditingQuestionId(null);
		setEditForm(null);
	};

	const handleSave = async (questionId: number) => {
		if (!editForm || editForm.answers.length < 1) return;
		setSaving(true);
		try {
			await updateQuestion({
				data: {
					id: questionId,
					question: editForm.question,
					options: editForm.options,
					answers: editForm.answers,
					scoringMode: editForm.scoringMode,
					explanation: editForm.explanation || "",
					deepExplanation: editForm.deepExplanation || "",
					topic: editForm.topic || "",
				},
			});
			queryClient.invalidateQueries({ queryKey: ["exam-detail", examId] });
			cancelEditing();
		} catch (err) {
			console.error("Failed to update question:", err);
		} finally {
			setSaving(false);
		}
	};

	return {
		editingQuestionId,
		editForm,
		saving,
		startEditing,
		cancelEditing,
		handleSave,
		setEditForm,
	};
}

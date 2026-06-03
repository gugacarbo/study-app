import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { updateQuestion } from "@/server-functions/exams";
import type { EditFormData } from "./exam-utils";

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

	const startEditing = (q: {
		id: number;
		question: string;
		options: string[];
		answer: string;
		explanation?: string | null;
		deepExplanation?: string | null;
		topic?: string | null;
	}) => {
		setEditingQuestionId(q.id);
		setEditForm({
			question: q.question,
			options: [...q.options],
			answer: q.answer,
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
		if (!editForm) return;
		setSaving(true);
		try {
			await updateQuestion({
				data: {
					id: questionId,
					question: editForm.question,
					options: editForm.options,
					answer: editForm.answer,
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

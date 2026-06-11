import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { updateExam } from "@/server-functions/exams";

interface UseExamNameEditingProps {
	examId: number;
	initialName: string;
}

export function useExamNameEditing({
	examId,
	initialName,
}: UseExamNameEditingProps) {
	const queryClient = useQueryClient();
	const [isEditing, setIsEditing] = useState(false);
	const [draftName, setDraftName] = useState(initialName);
	const [saving, setSaving] = useState(false);
	const skipBlurSaveRef = useRef(false);

	useEffect(() => {
		if (!isEditing) {
			setDraftName(initialName);
		}
	}, [initialName, isEditing]);

	const startEditing = () => {
		setDraftName(initialName);
		setIsEditing(true);
	};

	const cancelEditing = () => {
		setDraftName(initialName);
		setIsEditing(false);
	};

	const save = async () => {
		const trimmed = draftName.trim();
		if (!trimmed || trimmed === initialName) {
			cancelEditing();
			return;
		}

		setSaving(true);
		try {
			await updateExam({ data: { id: examId, name: trimmed } });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["exam-detail", examId] }),
				queryClient.invalidateQueries({ queryKey: ["exams-detailed"] }),
				queryClient.invalidateQueries({ queryKey: ["exams"] }),
			]);
			setIsEditing(false);
		} catch (err) {
			console.error("Failed to update exam name:", err);
		} finally {
			setSaving(false);
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			void save();
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			skipBlurSaveRef.current = true;
			cancelEditing();
		}
	};

	const handleBlur = () => {
		if (skipBlurSaveRef.current) {
			skipBlurSaveRef.current = false;
			return;
		}

		void save();
	};

	return {
		isEditing,
		draftName,
		saving,
		startEditing,
		setDraftName,
		handleKeyDown,
		handleBlur,
	};
}

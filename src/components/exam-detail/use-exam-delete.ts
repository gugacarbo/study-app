import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { deleteExam } from "../../server-functions/exams";

interface UseExamDeleteProps {
	examId: number;
}

export function useExamDelete({ examId }: UseExamDeleteProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [deleting, setDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const handleDelete = async () => {
		setDeleting(true);
		try {
			await deleteExam({ data: { id: examId } });
			queryClient.invalidateQueries({ queryKey: ["exams-detailed"] });
			queryClient.invalidateQueries({ queryKey: ["exams"] });
			queryClient.invalidateQueries({ queryKey: ["stats"] });
			router.navigate({ to: "/exams" });
		} catch (err) {
			console.error("Failed to delete exam:", err);
		} finally {
			setDeleting(false);
		}
	};

	return { deleting, confirmDelete, setConfirmDelete, handleDelete };
}

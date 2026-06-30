import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteExam } from "@/functions/exams/delete-exam";
import { EXAMS_QUERY_KEY } from "@/features/exams/hooks/use-exams";
import { examQueryKey } from "@/features/exams/hooks/use-exam";

export function useDeleteExam(examId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => deleteExam({ data: { examId } }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: EXAMS_QUERY_KEY });
			queryClient.removeQueries({ queryKey: examQueryKey(examId) });
		},
	});
}

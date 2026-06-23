import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateQuestion } from "@/functions/exams/update-question";
import { examQueryKey } from "@/features/exams/hooks/use-exam";
import type { QuestionFormInput } from "@/features/exams/lib/question-form-schema";

type UpdateQuestionPayload = QuestionFormInput & {
	examId: string;
	questionId: string;
};

export function useUpdateQuestion(examId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: UpdateQuestionPayload) =>
			updateQuestion({ data: payload }),
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: examQueryKey(examId) });
		},
	});
}

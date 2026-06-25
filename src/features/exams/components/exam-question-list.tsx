import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { ExamQuestionListItem } from "@/features/exams/components/exam-question-list-item";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

type ExamQuestionListProps = {
	examId: string;
	questions: QuestionDetail[];
	draftsByQuestionId?: Map<string, QuestionImprovementDraftRecord>;
};

export function ExamQuestionList({
	examId,
	questions,
	draftsByQuestionId,
}: ExamQuestionListProps) {
	if (questions.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">
				Nenhuma questão disponível nesta prova.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{questions.map((question, index) => (
				<ExamQuestionListItem
					key={question.id}
					index={index + 1}
					examId={examId}
					question={question}
					draft={draftsByQuestionId?.get(question.id)}
				/>
			))}
		</div>
	);
}

import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { Accordion } from "@/components/ui/accordion";
import { ExamQuestionItem } from "@/features/exams/components/exam-question-item";
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
		<Accordion type="multiple" className="flex flex-col gap-3">
			{questions.map((question, index) => (
				<ExamQuestionItem
					key={question.id}
					index={index + 1}
					examId={examId}
					question={question}
					draft={draftsByQuestionId?.get(question.id)}
				/>
			))}
		</Accordion>
	);
}

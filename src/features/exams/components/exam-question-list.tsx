import { ExamQuestionItem } from "@/features/exams/components/exam-question-item";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

type ExamQuestionListProps = {
	questions: QuestionDetail[];
};

export function ExamQuestionList({ questions }: ExamQuestionListProps) {
	if (questions.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">
				Nenhuma questão disponível nesta prova.
			</p>
		);
	}

	return (
		<ul className="flex flex-col gap-3">
			{questions.map((question, index) => (
				<li key={question.id}>
					<ExamQuestionItem index={index + 1} question={question} />
				</li>
			))}
		</ul>
	);
}

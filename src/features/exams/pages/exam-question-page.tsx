import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon } from "lucide-react";
import { Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExamQuestionItem } from "@/features/exams/components/exam-question-item";
import { useExam } from "@/features/exams/hooks/use-exam";
import { useQuestionImprovementDrafts } from "@/features/exams/hooks/use-question-improvement-drafts";

type ExamQuestionPageProps = {
	examId: string;
	questionId: string;
};

function ExamQuestionPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between gap-3">
				<Skeleton className="h-9 w-28" />
				<Skeleton className="h-5 w-16" />
				<div className="flex gap-2">
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-9 w-32" />
				</div>
			</div>
			<Skeleton className="h-72 w-full" />
		</div>
	);
}

function formatTopic(topic: string | null): string {
	return topic ?? "Geral";
}

export function ExamQuestionPageContent({
	examId,
	questionId,
}: ExamQuestionPageProps) {
	const navigate = useNavigate();
	const { data: exam } = useExam(examId);
	const { data: drafts = [] } = useQuestionImprovementDrafts(examId);
	const questionIndex = exam.questions.findIndex((question) => question.id === questionId);

	if (questionIndex === -1) {
		throw new Response("Not Found", { status: 404 });
	}

	const question = exam.questions[questionIndex]!;
	const previousQuestion = questionIndex > 0 ? exam.questions[questionIndex - 1] : null;
	const nextQuestion =
		questionIndex < exam.questions.length - 1
			? exam.questions[questionIndex + 1]
			: null;
	const draftsByQuestionId = new Map<string, QuestionImprovementDraftRecord>(
		(drafts as QuestionImprovementDraftRecord[]).map((draft) => [
			draft.questionId,
			draft,
		]),
	);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<Button
					type="button"
					variant="ghost"
					className="self-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
					onClick={() => void navigate({ to: "/exams/$examId", params: { examId } })}
				>
					<ChevronLeftIcon data-icon="inline-start" />
					Voltar para a prova
				</Button>
				<div className="space-y-1">
					<p className="text-sm font-medium">
						Q{questionIndex + 1} de {exam.questions.length}
					</p>
					<p className="text-sm text-muted-foreground">
						Q{questionIndex + 1} · {formatTopic(question.topic)}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={!previousQuestion}
						onClick={() => {
							if (!previousQuestion) return;
							void navigate({
								to: "/exams/$examId/questions/$questionId",
								params: { examId, questionId: previousQuestion.id },
							});
						}}
					>
						<ArrowLeftIcon data-icon="inline-start" />
						Questão anterior
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={!nextQuestion}
						onClick={() => {
							if (!nextQuestion) return;
							void navigate({
								to: "/exams/$examId/questions/$questionId",
								params: { examId, questionId: nextQuestion.id },
							});
						}}
					>
						Próxima questão
						<ArrowRightIcon data-icon="inline-end" />
					</Button>
				</div>
			</div>

			<ExamQuestionItem
				index={questionIndex + 1}
				examId={examId}
				question={question}
				draft={draftsByQuestionId.get(question.id)}
			/>
		</div>
	);
}

export function ExamQuestionPage(props: ExamQuestionPageProps) {
	return (
		<Suspense fallback={<ExamQuestionPageSkeleton />}>
			<ExamQuestionPageContent {...props} />
		</Suspense>
	);
}

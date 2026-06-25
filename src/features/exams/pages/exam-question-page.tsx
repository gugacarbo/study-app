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
			<div
				className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
				data-testid="question-page-toolbar"
			>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
							<p className="text-base font-semibold">
								Q{questionIndex + 1} de {exam.questions.length}
							</p>
							<p className="text-sm text-muted-foreground">
								Q{questionIndex + 1} · {formatTopic(question.topic)}
							</p>
						</div>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Button
							type="button"
							variant="secondary"
							size="lg"
							className="flex-1 justify-between sm:flex-none"
							disabled={!previousQuestion}
							onClick={() => {
								if (!previousQuestion) return;
								void navigate({
									to: "/exams/$examId/questions/$questionId",
									params: { examId, questionId: previousQuestion.id },
								});
							}}
						>
							<span className="inline-flex items-center gap-2">
								<ArrowLeftIcon data-icon="inline-start" />
								Questão anterior
							</span>
						</Button>
						<Button
							type="button"
							size="lg"
							className="flex-1 justify-between sm:flex-none"
							disabled={!nextQuestion}
							onClick={() => {
								if (!nextQuestion) return;
								void navigate({
									to: "/exams/$examId/questions/$questionId",
									params: { examId, questionId: nextQuestion.id },
								});
							}}
						>
							<span>Próxima questão</span>
							<ArrowRightIcon data-icon="inline-end" />
						</Button>
					</div>
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

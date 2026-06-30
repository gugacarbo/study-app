import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon, PencilLineIcon } from "lucide-react";
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
	const currentDraft = draftsByQuestionId.get(question.id);

	return (
		<div className="flex flex-col gap-6">
			<div
				className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
				data-testid="question-page-toolbar"
			>
				<div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 text-muted-foreground"
						aria-label="Voltar para a prova"
						title="Voltar para a prova"
						onClick={() => void navigate({ to: "/exams/$examId", params: { examId } })}
					>
						<ChevronLeftIcon />
					</Button>
					<div className="flex min-w-0 items-center gap-2 text-sm sm:ml-auto">
						<p className="shrink-0 font-semibold">
							Q{questionIndex + 1} de {exam.questions.length}
						</p>
						<p className="truncate text-muted-foreground">
							Q{questionIndex + 1} · {formatTopic(question.topic)}
						</p>
					</div>
					<div className="flex items-center gap-2 sm:ml-auto">
						<Button
							type="button"
							variant="secondary"
							size="icon"
							className="size-8"
							aria-label="Questão anterior"
							title="Questão anterior"
							disabled={!previousQuestion}
							onClick={() => {
								if (!previousQuestion) return;
								void navigate({
									to: "/exams/$examId/questions/$questionId",
									params: { examId, questionId: previousQuestion.id },
								});
							}}
						>
							<ArrowLeftIcon />
						</Button>
						<Button
							type="button"
							size="icon"
							className="size-8"
							aria-label="Próxima questão"
							title="Próxima questão"
							disabled={!nextQuestion}
							onClick={() => {
								if (!nextQuestion) return;
								void navigate({
									to: "/exams/$examId/questions/$questionId",
									params: { examId, questionId: nextQuestion.id },
								});
							}}
						>
							<ArrowRightIcon />
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="size-8"
							aria-label="Editar pergunta"
							title="Editar pergunta"
							onClick={() =>
								void navigate({
									to: "/exams/$examId/questions/$questionId/edit",
									params: { examId, questionId: question.id },
								})
							}
						>
							<PencilLineIcon />
						</Button>
					</div>
				</div>
			</div>

			<ExamQuestionItem
				index={questionIndex + 1}
				question={question}
				draft={currentDraft}
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

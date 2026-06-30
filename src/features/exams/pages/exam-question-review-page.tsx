import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import {
	ArrowRightIcon,
	ChevronLeftIcon,
	SparklesIcon,
} from "lucide-react";
import { Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionEditForm } from "@/features/exams/components/question-edit-form";
import { useExam } from "@/features/exams/hooks/use-exam";
import { useQuestionImprovementDraftActions } from "@/features/exams/hooks/use-question-improvement-draft-actions";
import { useQuestionImprovementDrafts } from "@/features/exams/hooks/use-question-improvement-drafts";
import { useUpdateQuestion } from "@/features/exams/hooks/use-update-question";
import { getReviewImprovementQuestionId } from "@/features/exams/lib/get-review-improvement-question-id";
import type { QuestionEditFormSubmission } from "@/features/exams/components/question-edit-form";
import type { QuestionFormInput } from "@/features/exams/lib/question-form-schema";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";

type ExamQuestionReviewPageProps = {
	examId: string;
	questionId: string;
};

function ExamQuestionReviewPageSkeleton() {
	return (
		<div
			className="flex flex-col gap-6"
			data-testid="question-improvement-review-loading"
		>
			<Skeleton className="h-28 w-full" />
			<Skeleton className="h-[36rem] w-full" />
		</div>
	);
}

function toSuggestedQuestion(
	question: QuestionDetail,
	draft: QuestionImprovementDraftRecord,
): QuestionDetail {
	return {
		id: question.id,
		question: draft.improvedSnapshot.question,
		options: draft.improvedSnapshot.options,
		answers: draft.improvedSnapshot.answers,
		topicId: draft.improvedSnapshot.topicId ?? null,
		topic: draft.improvedSnapshot.topic,
		scoringMode: draft.improvedSnapshot.scoringMode,
		explanation: draft.improvedSnapshot.explanation,
		deepExplanation: draft.improvedSnapshot.deepExplanation,
	};
}

function buildFinalSnapshot(
	data: QuestionFormInput & { topic: string | null },
) {
	return {
		question: data.question,
		options: data.options,
		answers: data.answers,
		topicId: data.topicId ?? null,
		topic: data.topic,
		scoringMode: data.scoringMode,
		explanation: data.explanation?.trim() ? data.explanation : null,
		deepExplanation: data.deepExplanation?.trim() ? data.deepExplanation : null,
	};
}

function getNextReviewQuestionId(
	questions: QuestionDetail[],
	drafts: QuestionImprovementDraftRecord[],
	currentQuestionId: string,
) {
	const remainingDrafts = drafts.filter(
		(draft) => draft.questionId !== currentQuestionId,
	);
	return getReviewImprovementQuestionId(questions, remainingDrafts);
}

export function ExamQuestionReviewPageContent({
	examId,
	questionId,
}: ExamQuestionReviewPageProps) {
	const navigate = useNavigate();
	const { data: exam } = useExam(examId);
	const draftsQuery = useQuestionImprovementDrafts(examId);
	const { resolveDraft } = useQuestionImprovementDraftActions(examId);
	const updateQuestion = useUpdateQuestion(examId);

	if (draftsQuery.isPending) {
		return <ExamQuestionReviewPageSkeleton />;
	}

	if (draftsQuery.isError) {
		throw draftsQuery.error;
	}

	const drafts = draftsQuery.data ?? [];

	const question = exam.questions.find((item) => item.id === questionId);
	if (!question) {
		throw new Response("Not Found", { status: 404 });
	}

	const draft = drafts.find((item) => item.questionId === questionId);

	async function goBackToQuestion() {
		await navigate({
			to: "/exams/$examId/questions/$questionId",
			params: { examId, questionId },
		});
	}

	const nextQuestionId = getNextReviewQuestionId(
		exam.questions,
		drafts,
		questionId,
	);

	async function goAfterResolution() {
		if (nextQuestionId) {
			await navigate({
				to: "/exams/$examId/questions/$questionId/edit",
				params: { examId, questionId: nextQuestionId },
			});
			return;
		}

		await goBackToQuestion();
	}

	async function handleGoToNextImprovement() {
		if (!nextQuestionId) return;

		await navigate({
			to: "/exams/$examId/questions/$questionId/edit",
			params: { examId, questionId: nextQuestionId },
		});
	}

	if (!draft) {
		async function handleManualSubmit(
			data: QuestionEditFormSubmission,
		) {
			const { topic: _topic, ...questionData } = data;
			await updateQuestion.mutateAsync({
				examId,
				questionId,
				...questionData,
			});
			await goBackToQuestion();
		}

		return (
			<div className="flex flex-col gap-6">
				<div className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs">
					<QuestionEditForm
						question={question}
						onSubmit={(data) => void handleManualSubmit(data)}
						onCancel={() => void goBackToQuestion()}
						isPending={updateQuestion.isPending}
					/>
					{updateQuestion.isError ? (
						<p className="mt-3 text-sm text-destructive">
							Não foi possível salvar a edição manual. Tente novamente.
						</p>
					) : null}
				</div>
			</div>
		);
	}

	const activeDraft = draft;
	const suggestedQuestion = toSuggestedQuestion(question, activeDraft);

	async function handleApprove(data: QuestionFormInput & { topic: string | null }) {
		await resolveDraft.mutateAsync({
			action: "approve",
			draftId: activeDraft.id,
			finalSnapshot: buildFinalSnapshot(data),
		});
		await goAfterResolution();
	}

	async function handleDiscard() {
		await resolveDraft.mutateAsync({
			action: "discard",
			draftId: activeDraft.id,
		});
		await goAfterResolution();
	}

	return (
		<div className="flex flex-col gap-6">
			<section className="rounded-xl border bg-card px-4 py-3 text-card-foreground shadow-xs">
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<Button
							type="button"
							variant="ghost"
							className="h-auto self-start px-0 py-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
							onClick={() => void goBackToQuestion()}
						>
							<ChevronLeftIcon data-icon="inline-start" />
							Voltar para a questão
						</Button>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">
								<SparklesIcon data-icon="inline-start" />
								Revisão de melhoria por questão
							</Badge>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-6 rounded-full px-3 text-xs text-muted-foreground"
								disabled={!nextQuestionId}
								onClick={() => void handleGoToNextImprovement()}
							>
								<ArrowRightIcon className="size-3.5" />
								Próxima melhoria
							</Button>
						</div>
					</div>
				</div>
			</section>

			<div className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs">
				<QuestionEditForm
					question={suggestedQuestion}
					baseQuestion={question}
					submitLabel="Aprovar"
					onSubmit={(data) => void handleApprove(data)}
					onDiscard={() => void handleDiscard()}
					onCancel={() => void goBackToQuestion()}
					isPending={resolveDraft.isPending}
				/>
				{resolveDraft.isError ? (
					<p className="mt-3 text-sm text-destructive">
						Não foi possível salvar a revisão. Tente novamente.
					</p>
				) : null}
			</div>
		</div>
	);
}

export function ExamQuestionReviewPage(props: ExamQuestionReviewPageProps) {
	return (
		<Suspense fallback={<ExamQuestionReviewPageSkeleton />}>
			<ExamQuestionReviewPageContent {...props} />
		</Suspense>
	);
}

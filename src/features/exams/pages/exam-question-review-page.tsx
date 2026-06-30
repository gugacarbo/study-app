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
import { QuestionImprovementReviewForm } from "@/features/exams/components/question-improvement-review-form";
import { useExam } from "@/features/exams/hooks/use-exam";
import { useQuestionImprovementDraftActions } from "@/features/exams/hooks/use-question-improvement-draft-actions";
import { useQuestionImprovementDrafts } from "@/features/exams/hooks/use-question-improvement-drafts";
import { getReviewImprovementQuestionId } from "@/features/exams/lib/get-review-improvement-question-id";
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
	if (!draft) {
		throw new Response("Not Found", { status: 404 });
	}
	const activeDraft = draft;

	const suggestedQuestion = toSuggestedQuestion(question, activeDraft);
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

		await navigate({
			to: "/exams/$examId/questions/$questionId",
			params: { examId, questionId },
		});
	}

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

	async function handleGoToNextImprovement() {
		if (!nextQuestionId) return;

		await navigate({
			to: "/exams/$examId/questions/$questionId/edit",
			params: { examId, questionId: nextQuestionId },
		});
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
							onClick={() =>
								void navigate({
									to: "/exams/$examId/questions/$questionId",
									params: { examId, questionId },
								})
							}
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

			<QuestionImprovementReviewForm
				currentQuestion={question}
				suggestedQuestion={suggestedQuestion}
				isPending={resolveDraft.isPending}
				onApprove={(data) => void handleApprove(data)}
				onDiscard={() => void handleDiscard()}
			/>
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

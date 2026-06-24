import { Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizAnswerReview } from "@/features/quiz/components/quiz-answer-review";
import { QuizResultSummary } from "@/features/quiz/components/quiz-result-summary";
import { useAttemptResult } from "@/features/quiz/hooks/use-attempt-result";
import { useStartAttempt } from "@/features/quiz/hooks/use-start-attempt";

type QuizResultPageProps = {
	examId: string;
	attemptId: string;
};

function QuizResultPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<Skeleton className="h-48 w-full" />
			<Skeleton className="h-32 w-full" />
			<Skeleton className="h-32 w-full" />
		</div>
	);
}

export function QuizResultPageContent({ examId, attemptId }: QuizResultPageProps) {
	const { data: result } = useAttemptResult(attemptId);
	const startAttempt = useStartAttempt(examId);
	const navigate = useNavigate();

	async function handleNewAttempt() {
		const attempt = await startAttempt.mutateAsync({
			order: "original",
			quantity: 0,
			topicFilter: null,
			revealMode: "after",
		});
		await navigate({
			to: "/exams/$examId/quiz/$attemptId",
			params: { examId, attemptId: attempt.id },
		});
	}

	return (
		<div className="relative">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-muted/60 via-background/30 to-transparent"
			/>
			<div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8">
				<QuizResultSummary
					scorePercent={result.scorePercent}
					totalQuestions={result.totalQuestions}
					answeredQuestions={result.answeredQuestions}
					correctAnswers={result.correctAnswers}
					onNewAttempt={handleNewAttempt}
					isStarting={startAttempt.isPending}
				/>

				<section className="flex flex-col gap-4">
					<div className="rounded-2xl border border-border/70 bg-card/95 px-5 py-4 shadow-sm sm:px-6">
						<p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Revisao questao por questao
						</p>
						<h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
							Entenda onde a tentativa ficou firme e onde ainda vale voltar.
						</h2>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							Use os cards abaixo para comparar sua escolha, o gabarito e a
							explicacao de cada questao sem perder o ritmo da revisao.
						</p>
					</div>

					<QuizAnswerReview result={result} />
				</section>
			</div>
		</div>
	);
}

export function QuizResultPage({ examId, attemptId }: QuizResultPageProps) {
	return (
		<Suspense fallback={<QuizResultPageSkeleton />}>
			<QuizResultPageContent examId={examId} attemptId={attemptId} />
		</Suspense>
	);
}

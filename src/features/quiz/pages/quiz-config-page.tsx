import { Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizConfigForm } from "@/features/quiz/components/quiz-config-form";
import { QuizLoading } from "@/features/quiz/components/quiz-loading";
import { QuizStart } from "@/features/quiz/components/quiz-start";
import { useExam } from "@/features/exams/hooks/use-exam";
import { useExamAttempts } from "@/features/quiz/hooks/use-exam-attempts";
import { useStartAttempt } from "@/features/quiz/hooks/use-start-attempt";
import { useTopicsByExam } from "@/features/quiz/hooks/use-topics-by-exam";
import type { QuizConfig } from "@/features/quiz/types/quiz";

type QuizConfigPageProps = {
	examId: string;
};

function QuizConfigPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<QuizLoading />
		</div>
	);
}

function QuizConfigPageContent({ examId }: QuizConfigPageProps) {
	const navigate = useNavigate();
	const { data: exam } = useExam(examId);
	const { data: topics = [] } = useTopicsByExam(examId);
	const { data: attempts = [] } = useExamAttempts(examId);
	const startAttempt = useStartAttempt(examId);

	async function handleStart(config: QuizConfig) {
		const attempt = await startAttempt.mutateAsync(config);
		await navigate({
			to: "/exams/$examId/quiz/$attemptId",
			params: { examId, attemptId: attempt.id },
		});
	}

	const hasSavedProgress = attempts.some(
		(attempt) => attempt.status === "in_progress",
	);
	const lastInProgress = hasSavedProgress
		? attempts.find((attempt) => attempt.status === "in_progress")
		: null;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between gap-3">
				<h1 className="text-xl font-semibold">{exam.name}</h1>
				{exam.questionCount > 0 ? (
					<span className="text-sm text-muted-foreground">
						{exam.questionCount}{" "}
						{exam.questionCount === 1 ? "questão" : "questões"}
					</span>
				) : null}
			</div>

			<QuizStart
				total={exam.questionCount}
				attempts={attempts}
				hasSavedProgress={hasSavedProgress}
				isStarting={startAttempt.isPending}
				onStart={async () => {
					await handleStart({
						quantity: exam.questionCount,
						order: "original",
						topicFilter: null,
						revealMode: "after",
					});
				}}
				onContinue={
					lastInProgress
						? () =>
								navigate({
									to: "/exams/$examId/quiz/$attemptId",
									params: {
										examId,
										attemptId: lastInProgress.id,
									},
								})
						: undefined
				}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Configurar novo quiz</CardTitle>
				</CardHeader>
				<CardContent>
					<QuizConfigForm
						availableTopics={topics}
						maxQuestions={exam.questionCount}
						defaultValues={{
							quantity: exam.questionCount,
							order: "original",
							topicFilter: null,
							revealMode: "after",
						}}
						onSubmit={handleStart}
						isPending={startAttempt.isPending}
					/>
				</CardContent>
			</Card>

			<Button
				variant="outline"
				onClick={() =>
					navigate({ to: "/exams/$examId", params: { examId } })
				}
			>
				Voltar para a prova
			</Button>
		</div>
	);
}

export function QuizConfigPage({ examId }: QuizConfigPageProps) {
	return (
		<Suspense fallback={<QuizConfigPageSkeleton />}>
			<QuizConfigPageContent examId={examId} />
		</Suspense>
	);
}

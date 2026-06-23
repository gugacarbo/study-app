import { Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizConfigForm } from "@/features/quiz/components/quiz-config-form";
import { useExam } from "@/features/exams/hooks/use-exam";
import { useStartAttempt } from "@/features/quiz/hooks/use-start-attempt";
import { useTopicsByExam } from "@/features/quiz/hooks/use-topics-by-exam";
import type { QuizConfig } from "@/features/quiz/types/quiz";

type QuizConfigPageProps = {
	examId: string;
};

function QuizConfigPageSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<Skeleton className="h-7 w-64" />
			<Skeleton className="h-40 w-full" />
		</div>
	);
}

function QuizConfigPageContent({ examId }: QuizConfigPageProps) {
	const navigate = useNavigate();
	const { data: exam } = useExam(examId);
	const { data: topics = [] } = useTopicsByExam(examId);
	const startAttempt = useStartAttempt(examId);

	async function handleSubmit(config: QuizConfig) {
		const attempt = await startAttempt.mutateAsync(config);
		await navigate({
			to: "/exams/$examId/quiz/$attemptId",
			params: { examId, attemptId: attempt.id },
		});
	}

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Configurar quiz</CardTitle>
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
						onSubmit={handleSubmit}
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

import { useState } from "react";
import { BrainIcon, ChevronDownIcon, PlayIcon, SettingsIcon } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExamImproveQuestionsDialog } from "@/features/exams/components/exam-improve-questions-dialog";
import { useActiveAttempt } from "@/features/quiz/hooks/use-active-attempt";
import { useStartAttempt } from "@/features/quiz/hooks/use-start-attempt";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import type { QuizConfig } from "@/features/quiz/types/quiz";

type ExamDetailActionsProps = {
	examId: string;
	questions: QuestionDetail[];
};

const DEFAULT_QUICK_CONFIG: QuizConfig = {
	order: "original",
	quantity: 0,
	topicFilter: null,
	revealMode: "after",
};

export function ExamDetailActions({
	examId,
	questions,
}: ExamDetailActionsProps) {
	const navigate = useNavigate();
	const [isImproveDialogOpen, setIsImproveDialogOpen] = useState(false);
	const { data: activeAttempt } = useActiveAttempt(examId);
	const startAttempt = useStartAttempt(examId);

	const hasQuestions = questions.length > 0;
	const isPending = startAttempt.isPending;

	async function handleStart(config: QuizConfig = DEFAULT_QUICK_CONFIG) {
		if (activeAttempt) {
			await navigate({
				to: "/exams/$examId/quiz/$attemptId",
				params: { examId, attemptId: activeAttempt.attempt.id },
			});
			return;
		}

		const attempt = await startAttempt.mutateAsync(config);
		await navigate({
			to: "/exams/$examId/quiz/$attemptId",
			params: { examId, attemptId: attempt.id },
		});
	}

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button disabled={!hasQuestions || isPending}>
							<PlayIcon data-icon="inline-start" />
							{isPending ? "Iniciando…" : "Fazer quiz"}
							<ChevronDownIcon data-icon="inline-end" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem
							onClick={() => handleStart()}
							disabled={!hasQuestions || isPending}
						>
							Iniciar com defaults
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								handleStart({
									...DEFAULT_QUICK_CONFIG,
									order: "random",
								})
							}
							disabled={!hasQuestions || isPending}
						>
							Ordem aleatória
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								handleStart({
									...DEFAULT_QUICK_CONFIG,
									revealMode: "during",
								})
							}
							disabled={!hasQuestions || isPending}
						>
							Revelar ao responder
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link
								to="/exams/$examId/quiz"
								params={{ examId }}
								className="flex items-center gap-2"
							>
								<SettingsIcon className="size-4" />
								Configurar quiz
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<Button
					variant="outline"
					onClick={() => setIsImproveDialogOpen(true)}
					disabled={questions.length === 0}
				>
					<BrainIcon data-icon="inline-start" />
					Melhorar
				</Button>
				<Badge variant="secondary">Quiz</Badge>
			</div>

			<ExamImproveQuestionsDialog
				examId={examId}
				open={isImproveDialogOpen}
				onOpenChange={setIsImproveDialogOpen}
				questions={questions}
			/>
		</>
	);
}

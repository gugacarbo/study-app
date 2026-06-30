import { useState } from "react";
import {
	BrainIcon,
	ChevronDownIcon,
	PlayIcon,
	SettingsIcon,
	Trash2Icon,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { useDeleteExam } from "@/features/exams/hooks/use-delete-exam";
import { useActiveAttempt } from "@/features/quiz/hooks/use-active-attempt";
import { useStartAttempt } from "@/features/quiz/hooks/use-start-attempt";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import type { QuizConfig } from "@/features/quiz/types/quiz";

type ExamDetailActionsProps = {
	examId: string;
	examName: string;
	questions: QuestionDetail[];
	reviewImprovementQuestionId?: string | null;
};

const DEFAULT_QUICK_CONFIG: QuizConfig = {
	order: "original",
	quantity: 0,
	topicFilter: null,
	revealMode: "after",
};

export function ExamDetailActions({
	examId,
	examName,
	questions,
	reviewImprovementQuestionId = null,
}: ExamDetailActionsProps) {
	const navigate = useNavigate();
	const [isImproveDialogOpen, setIsImproveDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const { data: activeAttempt } = useActiveAttempt(examId);
	const startAttempt = useStartAttempt(examId);
	const deleteExam = useDeleteExam(examId);

	const hasQuestions = questions.length > 0;
	const isStartPending = startAttempt.isPending;
	const isDeletePending = deleteExam.isPending;
	const isPending = isStartPending || isDeletePending;

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

	async function handleDelete() {
		await deleteExam.mutateAsync();
		setIsDeleteDialogOpen(false);
		await navigate({ to: "/exams" });
	}

	async function handleReviewImprovement() {
		if (!reviewImprovementQuestionId) return;

		await navigate({
			to: "/exams/$examId/questions/$questionId",
			params: {
				examId,
				questionId: reviewImprovementQuestionId,
			},
		});
	}

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button disabled={!hasQuestions || isPending}>
							<PlayIcon data-icon="inline-start" />
							{isStartPending ? "Iniciando…" : "Fazer quiz"}
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

				{reviewImprovementQuestionId ? (
					<Button
						variant="outline"
						onClick={handleReviewImprovement}
						disabled={isPending}
					>
						<BrainIcon data-icon="inline-start" />
						Revisar melhoria
					</Button>
				) : (
					<Button
						variant="outline"
						onClick={() => setIsImproveDialogOpen(true)}
						disabled={questions.length === 0 || isPending}
					>
						<BrainIcon data-icon="inline-start" />
						Melhorar
					</Button>
				)}
				<AlertDialog
					open={isDeleteDialogOpen}
					onOpenChange={setIsDeleteDialogOpen}
				>
					<AlertDialogTrigger asChild>
						<Button variant="outline" disabled={isPending}>
							<Trash2Icon data-icon="inline-start" />
							Excluir prova
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent className="border-destructive/20">
						<AlertDialogHeader>
							<AlertDialogTitle className="font-serif text-lg">Excluir prova</AlertDialogTitle>
							<AlertDialogDescription>
								Essa ação remove a prova "{examName}" e não pode ser desfeita.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel asChild>
								<Button variant="ghost" disabled={isDeletePending}>
									Cancelar
								</Button>
							</AlertDialogCancel>
							<AlertDialogAction asChild>
								<Button
									variant="destructive"
									onClick={handleDelete}
									disabled={isDeletePending}
								>
									<Trash2Icon data-icon="inline-start" />
									{isDeletePending ? "Excluindo..." : "Excluir"}
								</Button>
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<Badge variant="outline" className="font-body text-xs">Quiz</Badge>
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

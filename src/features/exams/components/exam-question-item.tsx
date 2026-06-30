import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import {
	CheckCircle2Icon,
	FileTextIcon,
	SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { QuestionEditForm } from "@/features/exams/components/question-edit-form";
import { useUpdateQuestion } from "@/features/exams/hooks/use-update-question";
import type { QuestionFormInput } from "@/features/exams/lib/question-form-schema";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { cn } from "@/lib/utils";

type ExamQuestionItemProps = {
	index: number;
	examId: string;
	question: QuestionDetail;
	draft?: QuestionImprovementDraftRecord;
	showEditButton?: boolean;
};

function formatTopic(topic: string | null): string {
	return topic ?? "Geral";
}

function formatOptionKey(key: string): string {
	return key.toLowerCase();
}

function formatScoringMode(scoringMode: QuestionDetail["scoringMode"]): string {
	return scoringMode === "partial" ? "Respostas múltiplas" : "Resposta única";
}

export function ExamQuestionItem({
	index,
	examId,
	question,
	draft,
	showEditButton = true,
}: ExamQuestionItemProps) {
	const navigate = useNavigate();
	const [isEditing, setIsEditing] = useState(false);
	const [displayQuestion, setDisplayQuestion] = useState(question);
	const updateQuestion = useUpdateQuestion(examId);
	const answerSet = new Set(displayQuestion.answers);

	async function handleSubmit(data: QuestionFormInput) {
		const updated = await updateQuestion.mutateAsync({
			examId,
			questionId: displayQuestion.id,
			...data,
		});
		setDisplayQuestion(updated);
		setIsEditing(false);
	}

	function openDedicatedEditScreen() {
		return navigate({
			to: "/exams/$examId/questions/$questionId/edit",
			params: {
				examId,
				questionId: displayQuestion.id,
			},
		});
	}

	const shouldRenderSidePanel = showEditButton || (!draft && isEditing);

	return (
		<div
			className={cn(
				"grid gap-4 xl:items-start",
				shouldRenderSidePanel
					? "xl:grid-cols-[minmax(0,1fr)_22rem]"
					: "xl:grid-cols-[minmax(0,1fr)]",
			)}
		>
			<div className="space-y-4" data-testid="question-main-panel">
				<div data-testid="question-page-main" className="space-y-4">
					<section className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs">
						<div className="flex flex-col gap-5">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="space-y-2">
									<p className="text-sm font-medium text-muted-foreground">
										Q{index} · {formatTopic(displayQuestion.topic)}
									</p>
									<div className="flex flex-wrap gap-2">
										<Badge variant="outline">
											{formatScoringMode(displayQuestion.scoringMode)}
										</Badge>
										<Badge variant="secondary">
											<FileTextIcon data-icon="inline-start" />
											{displayQuestion.options.length} alternativas
										</Badge>
									</div>
								</div>
								{draft ? (
									<Badge variant="secondary">
										<SparklesIcon data-icon="inline-start" />
										Melhoria pendente
									</Badge>
								) : null}
							</div>

							<div className="text-sm leading-7">
								<MarkdownRenderer content={displayQuestion.question} />
							</div>

							<ul className="flex flex-col gap-2" data-testid="question-options">
								{displayQuestion.options.map((option) => {
									const isCorrect = answerSet.has(option.key);
									return (
										<li
											key={option.key}
											className={cn(
												"flex items-start gap-3 rounded-lg border px-3 py-3 text-sm",
												isCorrect
													? "border-emerald-500/60 bg-emerald-50 text-foreground shadow-xs dark:bg-emerald-950/20"
													: "border-border/70 bg-background text-muted-foreground",
											)}
										>
											<span
												className={cn(
													"font-medium tabular-nums",
													isCorrect ? "text-emerald-700 dark:text-emerald-300" : "",
												)}
											>
												{formatOptionKey(option.key)})
											</span>
											<span className="min-w-0 flex-1">{option.text}</span>
											{isCorrect ? (
												<Badge variant="secondary" className="self-center">
													<CheckCircle2Icon data-icon="inline-start" />
													Correta
												</Badge>
											) : null}
										</li>
									);
								})}
							</ul>
						</div>
					</section>
				</div>
			</div>

			{shouldRenderSidePanel ? (
				<aside className="xl:sticky xl:top-6" data-testid="question-side-panel">
					<div data-testid="question-page-sidebar" className="space-y-4">
						<section className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs">
							<div className="flex flex-col gap-4">
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Q{index} · {formatTopic(displayQuestion.topic)}
									</p>
									<p className="text-sm text-muted-foreground">
										{formatScoringMode(displayQuestion.scoringMode)}
									</p>
								</div>

								<div
									className="space-y-4 rounded-lg border border-border/70 bg-background/70 p-4"
									data-testid="question-improvement-edit-panel"
								>
									<div className="space-y-1">
										<h2 className="text-sm font-semibold">
											{draft ? "Editar questão" : "Edição manual"}
										</h2>
										<p className="text-sm text-muted-foreground">
											{draft
												? "Abra a tela dedicada para revisar a melhoria pendente e ajustar a versão final da questão."
												: "Edite aqui quando quiser ajustar a questão fora do fluxo de melhoria."}
										</p>
									</div>

									{!draft && isEditing ? (
										<div className="space-y-4">
											<QuestionEditForm
												question={displayQuestion}
												onSubmit={handleSubmit}
												onCancel={() => setIsEditing(false)}
												isPending={updateQuestion.isPending}
											/>
											{updateQuestion.isError ? (
												<p className="text-sm text-destructive">
													Erro ao salvar. Tente novamente.
												</p>
											) : null}
										</div>
									) : (
										<div className="space-y-3">
											<Button
												type="button"
												variant="default"
												className="w-full"
												onClick={() =>
													draft
														? void openDedicatedEditScreen()
														: setIsEditing(true)
												}
											>
												Editar pergunta
											</Button>
											<p className="text-sm text-muted-foreground">
												{draft
													? "A melhoria pendente e a edição final agora acontecem na mesma tela dedicada."
													: "Revise o enunciado, confira as corretas e abra a edição quando quiser ajustar a questão."}
											</p>
										</div>
									)}
								</div>
							</div>
						</section>
					</div>
				</aside>
			) : null}
		</div>
	);
}

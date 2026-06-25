import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { CheckCircle2Icon, FileTextIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { QuestionEditForm } from "@/features/exams/components/question-edit-form";
import { useQuestionImprovementDraftActions } from "@/features/exams/hooks/use-question-improvement-draft-actions";
import { useUpdateQuestion } from "@/features/exams/hooks/use-update-question";
import type { QuestionFormInput } from "@/features/exams/lib/question-form-schema";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { cn } from "@/lib/utils";

type ExamQuestionItemProps = {
	index: number;
	examId: string;
	question: QuestionDetail;
	draft?: QuestionImprovementDraftRecord;
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
}: ExamQuestionItemProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [displayQuestion, setDisplayQuestion] = useState(question);
	const updateQuestion = useUpdateQuestion(examId);
	const { approveDraft, discardDraft } = useQuestionImprovementDraftActions(examId);

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

	function handleCancel() {
		setIsEditing(false);
	}

	async function handleApproveDraft() {
		if (!draft) return;
		await approveDraft.mutateAsync({ draftId: draft.id });
		setDisplayQuestion({
			...displayQuestion,
			...draft.improvedSnapshot,
		});
	}

	async function handleDiscardDraft() {
		if (!draft) return;
		await discardDraft.mutateAsync({ draftId: draft.id });
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
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

					{draft ? (
						<section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-sm shadow-xs dark:border-amber-900 dark:bg-amber-950/20">
							<div className="space-y-1">
								<Badge variant="secondary">
									<SparklesIcon data-icon="inline-start" />
									Melhoria pendente
								</Badge>
								{draft.summary ? (
									<p className="text-muted-foreground">{draft.summary}</p>
								) : null}
							</div>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2 rounded-lg border border-amber-200/80 bg-background/70 p-4 dark:border-amber-900/60">
									<p className="font-medium">Original</p>
									<div>
										<MarkdownRenderer content={draft.originalSnapshot.question} />
									</div>
								</div>
								<div className="space-y-2 rounded-lg border border-amber-200/80 bg-background/70 p-4 dark:border-amber-900/60">
									<p className="font-medium">Melhorada</p>
									<div>
										<MarkdownRenderer content={draft.improvedSnapshot.question} />
									</div>
								</div>
							</div>
						</section>
					) : null}
				</div>
			</div>

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

							{draft ? (
								<div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/20">
									<Badge variant="secondary">
										<SparklesIcon data-icon="inline-start" />
										Melhoria pendente
									</Badge>
									<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
										<Button
											type="button"
											size="sm"
											onClick={() => void handleApproveDraft()}
											disabled={approveDraft.isPending}
										>
											Aprovar melhoria
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => void handleDiscardDraft()}
											disabled={discardDraft.isPending}
										>
											Descartar melhoria
										</Button>
									</div>
								</div>
							) : null}

							{isEditing ? (
								<div className="space-y-4">
									<div className="space-y-1">
										<p className="text-sm font-medium">Editando pergunta</p>
										<p className="text-sm text-muted-foreground">
											As mudanças aparecem aqui sem esconder a questão.
										</p>
									</div>
									<QuestionEditForm
										question={displayQuestion}
										onSubmit={handleSubmit}
										onCancel={handleCancel}
										isPending={updateQuestion.isPending}
									/>
									{updateQuestion.isError && (
										<p className="text-sm text-destructive">
											Erro ao salvar. Tente novamente.
										</p>
									)}
								</div>
							) : (
								<div className="space-y-3">
									<Button type="button" className="w-full" onClick={() => setIsEditing(true)}>
										Editar pergunta
									</Button>
									<p className="text-sm text-muted-foreground">
										Revise o enunciado, confira as corretas e abra a edição quando quiser ajustar a questão.
									</p>
								</div>
							)}
						</div>
					</section>
				</div>
			</aside>
		</div>
	);
}

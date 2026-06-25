import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuestionEditForm } from "@/features/exams/components/question-edit-form";
import { useQuestionImprovementDraftActions } from "@/features/exams/hooks/use-question-improvement-draft-actions";
import { useUpdateQuestion } from "@/features/exams/hooks/use-update-question";
import type { QuestionFormInput } from "@/features/exams/lib/question-form-schema";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { MarkdownRenderer } from "@/components/ui/markdown";

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
		<div className="rounded-xl border bg-card px-4 py-4 text-card-foreground shadow-xs">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium text-muted-foreground">
						Q{index} · {formatTopic(displayQuestion.topic)}
					</p>
				</div>

				{isEditing ? (
					<div>
						<QuestionEditForm
							question={displayQuestion}
							onSubmit={handleSubmit}
							onCancel={handleCancel}
							isPending={updateQuestion.isPending}
						/>
						{updateQuestion.isError && (
							<p className="mt-2 text-sm text-destructive">
								Erro ao salvar. Tente novamente.
							</p>
						)}
					</div>
				) : (
					<>
						{draft ? (
							<div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
								<div className="flex items-center justify-between gap-2">
									<Badge variant="secondary">Melhoria pendente</Badge>
									<div className="flex gap-2">
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
								{draft.summary ? (
									<p className="text-muted-foreground">{draft.summary}</p>
								) : null}
								<div className="grid gap-3 md:grid-cols-2">
									<div>
										<p className="mb-1 font-medium">Original</p>
										<div>
											<MarkdownRenderer content={draft.originalSnapshot.question} />
										</div>
									</div>
									<div>
										<p className="mb-1 font-medium">Melhorada</p>
										<div>
											<MarkdownRenderer content={draft.improvedSnapshot.question} />
										</div>
									</div>
								</div>
							</div>
						) : null}

						<div className="text-sm leading-relaxed">
							<MarkdownRenderer content={displayQuestion.question} />
						</div>

						<ul className="flex flex-col gap-1.5" data-testid="question-options">
							{displayQuestion.options.map((option) => {
								const isCorrect = answerSet.has(option.key);
								return (
									<li
										key={option.key}
										className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm ${
											isCorrect
												? "border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
												: "text-muted-foreground"
										}`}
									>
										<span className="font-medium tabular-nums">
											{formatOptionKey(option.key)})
										</span>
										<span>{option.text}</span>
									</li>
								);
							})}
						</ul>

						<Button
							type="button"
							variant="outline"
							size="sm"
							className="self-start"
							onClick={() => setIsEditing(true)}
						>
							Editar pergunta
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

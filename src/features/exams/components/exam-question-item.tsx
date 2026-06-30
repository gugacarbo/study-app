import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import {
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronUpIcon,
	FileTextIcon,
	SparklesIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
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

type QuestionImprovementSnapshot =
	QuestionImprovementDraftRecord["originalSnapshot"];

type DraftDiffSectionKey =
	| "stem"
	| "options"
	| "answers"
	| "explanation"
	| "deep-explanation"
	| "metadata";

type DraftDiffSection = {
	key: DraftDiffSectionKey;
	title: string;
	before: ReactNode;
	after: ReactNode;
	testId: string;
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

function formatAnswers(answers: string[]): string {
	return answers.map((answer) => formatOptionKey(answer)).join(", ");
}

function normalizeNullableText(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function answersEqual(left: string[], right: string[]): boolean {
	return [...left].sort().join("|") === [...right].sort().join("|");
}

function optionsEqual(
	left: QuestionImprovementSnapshot["options"],
	right: QuestionImprovementSnapshot["options"],
): boolean {
	if (left.length !== right.length) return false;

	return left.every((option, index) => {
		const other = right[index];
		return other && option.key === other.key && option.text === other.text;
	});
}

function renderSnapshotField(content: string | null) {
	if (!content) {
		return <p className="text-muted-foreground">Não informado.</p>;
	}

	return <MarkdownRenderer content={content} />;
}

function buildDraftDiffSections(
	draft: QuestionImprovementDraftRecord,
): DraftDiffSection[] {
	const { originalSnapshot, improvedSnapshot } = draft;
	const sections: DraftDiffSection[] = [];

	if (originalSnapshot.question !== improvedSnapshot.question) {
		sections.push({
			key: "stem",
			title: "Enunciado",
			testId: "question-improvement-section-stem",
			before: <MarkdownRenderer content={originalSnapshot.question} />,
			after: <MarkdownRenderer content={improvedSnapshot.question} />,
		});
	}

	if (!optionsEqual(originalSnapshot.options, improvedSnapshot.options)) {
		sections.push({
			key: "options",
			title: "Alternativas",
			testId: "question-improvement-section-options",
			before: (
				<DraftOptionsList
					options={originalSnapshot.options}
					answers={originalSnapshot.answers}
					compareTo={improvedSnapshot.options}
				/>
			),
			after: (
				<DraftOptionsList
					options={improvedSnapshot.options}
					answers={improvedSnapshot.answers}
					compareTo={originalSnapshot.options}
				/>
			),
		});
	}

	if (!answersEqual(originalSnapshot.answers, improvedSnapshot.answers)) {
		sections.push({
			key: "answers",
			title: "Resposta correta",
			testId: "question-improvement-section-answers",
			before: <p>{formatAnswers(originalSnapshot.answers)}</p>,
			after: <p>{formatAnswers(improvedSnapshot.answers)}</p>,
		});
	}

	if (
		normalizeNullableText(originalSnapshot.explanation) !==
		normalizeNullableText(improvedSnapshot.explanation)
	) {
		sections.push({
			key: "explanation",
			title: "Explicação",
			testId: "question-improvement-section-explanation",
			before: renderSnapshotField(originalSnapshot.explanation),
			after: renderSnapshotField(improvedSnapshot.explanation),
		});
	}

	if (
		normalizeNullableText(originalSnapshot.deepExplanation) !==
		normalizeNullableText(improvedSnapshot.deepExplanation)
	) {
		sections.push({
			key: "deep-explanation",
			title: "Explicação detalhada",
			testId: "question-improvement-section-deep-explanation",
			before: renderSnapshotField(originalSnapshot.deepExplanation),
			after: renderSnapshotField(improvedSnapshot.deepExplanation),
		});
	}

	if (
		normalizeNullableText(originalSnapshot.topic) !==
			normalizeNullableText(improvedSnapshot.topic) ||
		originalSnapshot.scoringMode !== improvedSnapshot.scoringMode
	) {
		sections.push({
			key: "metadata",
			title: "Metadados",
			testId: "question-improvement-section-metadata",
			before: <DraftMetadataSnapshot snapshot={originalSnapshot} />,
			after: <DraftMetadataSnapshot snapshot={improvedSnapshot} />,
		});
	}

	return sections;
}

function DraftMetadataSnapshot({
	snapshot,
}: {
	snapshot: QuestionImprovementSnapshot;
}) {
	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Tópico
				</p>
				<p>{formatTopic(snapshot.topic)}</p>
			</div>
			<div className="space-y-1">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Modo de correção
				</p>
				<p>{formatScoringMode(snapshot.scoringMode)}</p>
			</div>
		</div>
	);
}

function DraftOptionsList({
	options,
	answers,
	compareTo,
}: {
	options: QuestionImprovementSnapshot["options"];
	answers: string[];
	compareTo: QuestionImprovementSnapshot["options"];
}) {
	const answerSet = new Set(answers);

	return (
		<ul className="space-y-2">
			{options.map((option, index) => {
				const compareOption = compareTo[index];
				const isChanged =
					!compareOption ||
					compareOption.key !== option.key ||
					compareOption.text !== option.text;
				const isCorrect = answerSet.has(option.key);

				return (
					<li
						key={`${option.key}-${index}`}
						className={cn(
							"rounded-lg border px-3 py-2",
							isChanged
								? "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
								: "border-border/70 bg-background/80",
						)}
					>
						<div className="flex items-start gap-2">
							<span className="font-medium">{formatOptionKey(option.key)})</span>
							<span className="min-w-0 flex-1">{option.text}</span>
							{isCorrect ? (
								<Badge variant="outline" className="self-center">
									Correta
								</Badge>
							) : null}
						</div>
					</li>
				);
			})}
		</ul>
	);
}

function DraftReviewSection({
	title,
	before,
	after,
	testId,
}: Omit<DraftDiffSection, "key">) {
	return (
		<section
			className="rounded-xl border border-amber-200/80 bg-background/70 p-4 shadow-xs dark:border-amber-900/60"
			data-testid={testId}
		>
			<div className="space-y-4">
				<h3 className="text-sm font-semibold">{title}</h3>
				<div className="grid gap-4 lg:grid-cols-2">
					<div
						className="space-y-2 rounded-lg border border-border/70 bg-background/80 p-3"
						data-testid="question-improvement-before"
					>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Antes
						</p>
						<div className="text-sm leading-6">{before}</div>
					</div>
					<div
						className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/15"
						data-testid="question-improvement-after"
					>
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							Depois
						</p>
						<div className="text-sm leading-6">{after}</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function DraftSnapshotPanel({
	title,
	snapshot,
}: {
	title: string;
	snapshot: QuestionImprovementDraftRecord["originalSnapshot"];
}) {
	return (
		<div className="space-y-4 rounded-lg border border-amber-200/80 bg-background/70 p-4 dark:border-amber-900/60">
			<p className="font-medium">{title}</p>
			<div className="space-y-1">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Tópico
				</p>
				<p>{formatTopic(snapshot.topic)}</p>
			</div>
			<div className="space-y-1">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Modo de correção
				</p>
				<p>{formatScoringMode(snapshot.scoringMode)}</p>
			</div>
			<div className="space-y-1">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Respostas corretas
				</p>
				<p>{formatAnswers(snapshot.answers)}</p>
			</div>
			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Enunciado
				</p>
				<div>
					<MarkdownRenderer content={snapshot.question} />
				</div>
			</div>
			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Alternativas
				</p>
				<ul className="space-y-2">
					{snapshot.options.map((option) => (
						<li key={option.key} className="rounded-md border border-border/70 px-3 py-2">
							<span className="font-medium">{formatOptionKey(option.key)}) </span>
							<span>{option.text}</span>
						</li>
					))}
				</ul>
			</div>
			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Explicação
				</p>
				<div>{renderSnapshotField(snapshot.explanation)}</div>
			</div>
			<div className="space-y-2">
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Explicação detalhada
				</p>
				<div>{renderSnapshotField(snapshot.deepExplanation)}</div>
			</div>
		</div>
	);
}

export function ExamQuestionItem({
	index,
	examId,
	question,
	draft,
}: ExamQuestionItemProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [isShowingFullSnapshots, setIsShowingFullSnapshots] = useState(false);
	const [displayQuestion, setDisplayQuestion] = useState(question);
	const updateQuestion = useUpdateQuestion(examId);
	const { approveDraft, discardDraft } = useQuestionImprovementDraftActions(examId);
	const draftDiffSections = draft ? buildDraftDiffSections(draft) : [];

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
						<section
							className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-sm shadow-xs dark:border-amber-900 dark:bg-amber-950/20"
							data-testid="question-improvement-review"
						>
							<div className="space-y-2">
								<Badge variant="secondary">
									<SparklesIcon data-icon="inline-start" />
									Melhoria pendente
								</Badge>
								<div className="space-y-1">
									<h2 className="text-base font-semibold">Revisão da melhoria</h2>
									<p className="text-muted-foreground">
										Compare apenas os campos alterados antes de decidir na lateral.
									</p>
								</div>
								{draft.summary ? (
									<p
										className="text-muted-foreground"
										data-testid="question-improvement-summary"
									>
										{draft.summary}
									</p>
								) : null}
							</div>

							<div className="space-y-4" data-testid="question-improvement-diff">
								{draftDiffSections.map((section) => {
									const { key, ...sectionProps } = section;
									return <DraftReviewSection key={key} {...sectionProps} />;
								})}
							</div>

							<div className="rounded-lg border border-dashed border-amber-300/80 bg-background/60 p-3 dark:border-amber-900/70">
								<Button
									type="button"
									variant="ghost"
									className="w-full justify-between"
									data-testid="question-improvement-full-snapshots-toggle"
									onClick={() =>
										setIsShowingFullSnapshots((current) => !current)
									}
								>
									<span>Ver snapshot completo</span>
									{isShowingFullSnapshots ? (
										<ChevronUpIcon data-icon="inline-end" />
									) : (
										<ChevronDownIcon data-icon="inline-end" />
									)}
								</Button>

								{isShowingFullSnapshots ? (
									<div
										className="mt-3 grid gap-4 md:grid-cols-2"
										data-testid="question-improvement-full-snapshots"
									>
										<DraftSnapshotPanel
											title="Original"
											snapshot={draft.originalSnapshot}
										/>
										<DraftSnapshotPanel
											title="Melhorada"
											snapshot={draft.improvedSnapshot}
										/>
									</div>
								) : null}
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
								<div
									className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/20"
									data-testid="question-improvement-decision-panel"
								>
									<div className="space-y-2">
										<Badge variant="secondary">
											<SparklesIcon data-icon="inline-start" />
											Melhoria pendente
										</Badge>
										<div className="space-y-1">
											<h2 className="text-sm font-semibold">
												Decisão sobre a melhoria
											</h2>
											<p className="text-sm text-muted-foreground">
												Revise a proposta no painel principal e decida aqui.
											</p>
										</div>
										{draft.summary ? (
											<p className="text-sm text-muted-foreground">
												{draft.summary}
											</p>
										) : null}
									</div>
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

							<div
								className="space-y-4 rounded-lg border border-border/70 bg-background/70 p-4"
								data-testid="question-improvement-edit-panel"
							>
								<div className="space-y-1">
									<h2 className="text-sm font-semibold">Edição manual</h2>
									<p className="text-sm text-muted-foreground">
										Use a edição apenas quando quiser ajustar a questão manualmente.
									</p>
								</div>

								{isEditing ? (
									<div className="space-y-4">
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
										<Button
											type="button"
											variant={draft ? "outline" : "default"}
											className="w-full"
											onClick={() => setIsEditing(true)}
										>
											Editar pergunta
										</Button>
										<p className="text-sm text-muted-foreground">
											Revise o enunciado, confira as corretas e abra a edição quando quiser ajustar a questão.
										</p>
									</div>
								)}
							</div>
						</div>
					</section>
				</div>
			</aside>
		</div>
	);
}

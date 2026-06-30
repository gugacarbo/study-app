import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRightIcon, BotIcon, Layers2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createQuestionTopicServerFn } from "@/functions/exams/create-question-topic";
import { searchQuestionTopics } from "@/functions/exams/search-question-topics";
import {
	questionFormSchema,
	type QuestionFormInput,
} from "@/features/exams/lib/question-form-schema";
import { buildQuestionImprovementDiff } from "@/features/exams/lib/build-question-improvement-diff";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { cn } from "@/lib/utils";

type SnapshotSource = Pick<
	QuestionDetail,
	| "question"
	| "topicId"
	| "topic"
	| "scoringMode"
	| "options"
	| "answers"
	| "explanation"
	| "deepExplanation"
>;

type QuestionImprovementReviewFormProps = {
	currentQuestion: QuestionDetail;
	suggestedQuestion: QuestionDetail;
	isPending?: boolean;
	onApprove: (data: QuestionFormInput & { topic: string | null }) => void;
	onDiscard: () => void;
};

function generateOptionKey(index: number): string {
	return String.fromCharCode(65 + index);
}

function formatOptionKey(key: string): string {
	return key.toLowerCase();
}

type TopicResult = {
	topicId: string;
	name: string;
	normalizedName: string;
	similarityLabel: "exact" | "normalized_exact" | "prefix" | "partial";
};

function formatScoringModeLabel(scoringMode: SnapshotSource["scoringMode"]) {
	return scoringMode === "partial" ? "Respostas múltiplas" : "Resposta única";
}

function ComparisonCard({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2 rounded-lg border border-border/70 bg-background/70 p-3">
			<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
				{label}
			</p>
			<div className="space-y-2 text-sm text-foreground">{children}</div>
		</div>
	);
}

function SnapshotPreview({
	snapshot,
	section,
}: {
	snapshot: SnapshotSource;
	section:
		| "stem"
		| "metadata"
		| "options"
		| "explanation"
		| "deepExplanation";
}) {
	if (section === "stem") {
		return <p className="whitespace-pre-wrap leading-6">{snapshot.question}</p>;
	}

	if (section === "metadata") {
		return (
			<div className="flex flex-col gap-2">
				<div>
					<p className="text-xs text-muted-foreground">Tópico</p>
					<p>{snapshot.topic ?? "Sem tópico"}</p>
				</div>
				<div>
					<p className="text-xs text-muted-foreground">Modo de pontuação</p>
					<p>{formatScoringModeLabel(snapshot.scoringMode)}</p>
				</div>
			</div>
		);
	}

	if (section === "options") {
		const answerSet = new Set(snapshot.answers);
		return (
			<ul className="space-y-2">
				{snapshot.options.map((option) => (
					<li
						key={option.key}
						className="flex items-start gap-2 rounded-md border border-border/60 px-2.5 py-2"
					>
						<span className="text-xs font-medium text-muted-foreground">
							{formatOptionKey(option.key)})
						</span>
						<span className="flex-1">{option.text}</span>
						{answerSet.has(option.key) ? (
							<Badge variant="secondary" className="shrink-0">
								Correta
							</Badge>
						) : null}
					</li>
				))}
			</ul>
		);
	}

	const value =
		section === "explanation"
			? snapshot.explanation
			: snapshot.deepExplanation;
	return (
		<p className="whitespace-pre-wrap leading-6 text-muted-foreground">
			{value?.trim() ? value : "Sem conteúdo"}
		</p>
	);
}

function SectionComparison({
	current,
	suggested,
	section,
}: {
	current: SnapshotSource;
	suggested: SnapshotSource;
	section:
		| "stem"
		| "metadata"
		| "options"
		| "explanation"
		| "deepExplanation";
}) {
	return (
		<div className="space-y-3">
			<ComparisonCard label="Versão atual">
				<SnapshotPreview snapshot={current} section={section} />
			</ComparisonCard>
			<ComparisonCard label="Versão gerada">
				<SnapshotPreview snapshot={suggested} section={section} />
			</ComparisonCard>
		</div>
	);
}

function ReviewSection({
	testId,
	title,
	description,
	currentLabel,
	suggestionLabel,
	onUseCurrent,
	onUseSuggestion,
	comparison,
	isMerge = true,
	children,
}: {
	testId?: string;
	title: string;
	description: string;
	currentLabel: string;
	suggestionLabel: string;
	onUseCurrent: () => void;
	onUseSuggestion: () => void;
	comparison?: React.ReactNode;
	isMerge?: boolean;
	children: React.ReactNode;
}) {
	return (
		<section
			className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-xs"
			data-testid={testId}
		>
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Badge variant="outline">{title}</Badge>
							{isMerge ? (
								<Badge variant="secondary">
									<ArrowLeftRightIcon data-icon="inline-start" />
									Merge
								</Badge>
							) : null}
						</div>
						{isMerge ? (
							<p className="text-xs text-muted-foreground">{description}</p>
						) : null}
					</div>
					{isMerge ? (
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={onUseCurrent}
								title={currentLabel}
							>
								<Layers2Icon data-icon="inline-start" />
								Atual
							</Button>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={onUseSuggestion}
								title={suggestionLabel}
							>
								<BotIcon data-icon="inline-start" />
								IA
							</Button>
						</div>
					) : null}
				</div>
				{comparison}
				{children}
			</div>
		</section>
	);
}

export function QuestionImprovementReviewForm({
	currentQuestion,
	suggestedQuestion,
	isPending = false,
	onApprove,
	onDiscard,
}: QuestionImprovementReviewFormProps) {
	const form = useForm<QuestionFormInput>({
		resolver: zodResolver(questionFormSchema),
		defaultValues: {
			question: suggestedQuestion.question,
			topicId: suggestedQuestion.topicId ?? null,
			scoringMode: suggestedQuestion.scoringMode,
			options: suggestedQuestion.options,
			answers: suggestedQuestion.answers,
			explanation: suggestedQuestion.explanation ?? "",
			deepExplanation: suggestedQuestion.deepExplanation ?? "",
		},
	});
	const [topicQuery, setTopicQuery] = useState(suggestedQuestion.topic ?? "");
	const [topicResults, setTopicResults] = useState<TopicResult[]>([]);
	const [isSearchingTopics, setIsSearchingTopics] = useState(false);
	const [isCreatingTopic, setIsCreatingTopic] = useState(false);
	const improvementDiff = buildQuestionImprovementDiff({
		original: currentQuestion,
		improved: suggestedQuestion,
	});
	const hasStemChanges = improvementDiff.sections.stem.changed;
	const hasMetadataChanges = improvementDiff.sections.metadata.changed;
	const hasOptionsChanges =
		improvementDiff.sections.options.changed ||
		improvementDiff.sections.answers.changed;
	const hasExplanationChanges = improvementDiff.sections.explanation.changed;
	const hasDeepExplanationChanges =
		improvementDiff.sections.deepExplanation.changed;

	const { fields, append, remove, replace } = useFieldArray({
		control: form.control,
		name: "options",
	});

	const watchedOptions = useWatch({
		control: form.control,
		name: "options",
		defaultValue: suggestedQuestion.options,
	});
	const watchedAnswers = useWatch({
		control: form.control,
		name: "answers",
		defaultValue: suggestedQuestion.answers,
	});
	const watchedScoringMode = useWatch({
		control: form.control,
		name: "scoringMode",
		defaultValue: suggestedQuestion.scoringMode,
	});

	function useSnapshot(snapshot: SnapshotSource, section: "stem" | "metadata" | "options" | "explanation" | "deepExplanation") {
		if (section === "stem") {
			form.setValue("question", snapshot.question, { shouldDirty: true });
			return;
		}

		if (section === "metadata") {
			form.setValue("topicId", snapshot.topicId ?? null, { shouldDirty: true });
			form.setValue("scoringMode", snapshot.scoringMode, { shouldDirty: true });
			if (snapshot.scoringMode === "exact" && snapshot.answers.length > 1) {
				form.setValue("answers", snapshot.answers.slice(0, 1), { shouldDirty: true });
			} else {
				form.setValue("answers", [...snapshot.answers], { shouldDirty: true });
			}
			setTopicQuery(snapshot.topic ?? "");
			return;
		}

		if (section === "options") {
			replace(snapshot.options.map((option) => ({ ...option })));
			form.setValue("answers", [...snapshot.answers], { shouldDirty: true });
			return;
		}

		if (section === "explanation") {
			form.setValue("explanation", snapshot.explanation ?? "", { shouldDirty: true });
			return;
		}

		form.setValue("deepExplanation", snapshot.deepExplanation ?? "", {
			shouldDirty: true,
		});
	}

	function handleAddOption() {
		const currentOptions = form.getValues("options");
		if (currentOptions.length >= 10) return;
		append({ key: generateOptionKey(currentOptions.length), text: "" });
	}

	function handleRemoveOption(index: number) {
		const currentOptions = form.getValues("options");
		if (currentOptions.length <= 2) return;

		const removedKey = currentOptions[index]?.key;
		remove(index);

		if (!removedKey) return;

		form.setValue(
			"answers",
			form.getValues("answers").filter((answer) => answer !== removedKey),
			{ shouldDirty: true },
		);
	}

	function handleSelectAnswer(key: string) {
		form.setValue("answers", [key], { shouldDirty: true });
	}

	function handleToggleAnswer(key: string, checked: boolean) {
		const currentAnswers = form.getValues("answers");
		if (watchedScoringMode === "exact") {
			form.setValue("answers", checked ? [key] : [], { shouldDirty: true });
			return;
		}

		if (checked) {
			form.setValue("answers", [...currentAnswers, key], { shouldDirty: true });
			return;
		}

		form.setValue(
			"answers",
			currentAnswers.filter((answer) => answer !== key),
			{ shouldDirty: true },
		);
	}

	async function handleSearchTopics() {
		if (!topicQuery.trim()) {
			setTopicResults([]);
			return;
		}

		setIsSearchingTopics(true);
		try {
			const results = await searchQuestionTopics({
				data: { query: topicQuery, limit: 5 },
			});
			setTopicResults(results);
		} finally {
			setIsSearchingTopics(false);
		}
	}

	async function handleCreateTopic() {
		if (!topicQuery.trim()) return;

		setIsCreatingTopic(true);
		try {
			const result = await createQuestionTopicServerFn({
				data: { name: topicQuery },
			});
			form.setValue("topicId", result.topic.topicId, { shouldDirty: true });
			setTopicQuery(result.topic.name);
			setTopicResults([
				{ ...result.topic, similarityLabel: "normalized_exact" },
			]);
		} finally {
			setIsCreatingTopic(false);
		}
	}

	return (
		<form
			onSubmit={form.handleSubmit((data) =>
				onApprove({
					...data,
					topic: topicQuery.trim() ? topicQuery.trim() : null,
				}),
			)}
			className="space-y-4"
		>
			<div className="space-y-4" data-testid="question-improvement-review-layout">
				<ReviewSection
					testId="question-improvement-review-stem-section"
					title="Enunciado"
					description="O texto final já começa pela sugestão da IA, mas você pode puxar a versão atual com um clique."
					currentLabel="Usar versão atual no enunciado"
					suggestionLabel="Usar sugestão IA no enunciado"
					onUseCurrent={() => useSnapshot(currentQuestion, "stem")}
					onUseSuggestion={() => useSnapshot(suggestedQuestion, "stem")}
					isMerge={hasStemChanges}
					comparison={
						hasStemChanges ? (
						<SectionComparison
							current={currentQuestion}
							suggested={suggestedQuestion}
							section="stem"
						/>
						) : undefined
					}
				>
					<Field orientation="vertical">
						<FieldLabel htmlFor="review-question">Enunciado</FieldLabel>
						<FieldContent>
							<Textarea id="review-question" rows={4} {...form.register("question")} />
							<FieldError errors={[form.formState.errors.question]} />
						</FieldContent>
					</Field>
				</ReviewSection>

				<ReviewSection
					testId="question-improvement-review-metadata-section"
					title="Metadados"
					description="Tópico e modo de correção podem seguir a versão atual, a sugestão ou uma combinação manual."
					currentLabel="Usar versão atual nos metadados"
					suggestionLabel="Usar sugestão IA nos metadados"
					onUseCurrent={() => useSnapshot(currentQuestion, "metadata")}
					onUseSuggestion={() => useSnapshot(suggestedQuestion, "metadata")}
					isMerge={hasMetadataChanges}
					comparison={
						hasMetadataChanges ? (
						<SectionComparison
							current={currentQuestion}
							suggested={suggestedQuestion}
							section="metadata"
						/>
						) : undefined
					}
				>
					<div className="grid grid-cols-1 gap-4">
						<Field orientation="vertical">
							<FieldLabel htmlFor="review-topic">Tópico</FieldLabel>
							<FieldContent className="gap-2">
								<Input
									id="review-topic"
									value={topicQuery}
									onChange={(event) => {
										setTopicQuery(event.target.value);
										form.setValue("topicId", null, { shouldDirty: true });
									}}
								/>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void handleSearchTopics()}
										disabled={isSearchingTopics || isPending}
									>
										{isSearchingTopics ? "Buscando..." : "Buscar"}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void handleCreateTopic()}
										disabled={isCreatingTopic || isPending}
									>
										{isCreatingTopic ? "Criando..." : "Criar tópico"}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											form.setValue("topicId", null, { shouldDirty: true });
											setTopicQuery("");
											setTopicResults([]);
										}}
										disabled={isPending}
									>
										Sem tópico
									</Button>
								</div>
								{topicResults.length > 0 ? (
									<div className="flex flex-wrap gap-2">
										{topicResults.map((topic) => (
											<Button
												key={topic.topicId}
												type="button"
												variant={
													form.getValues("topicId") === topic.topicId
														? "default"
														: "secondary"
												}
												size="sm"
												onClick={() => {
													form.setValue("topicId", topic.topicId, {
														shouldDirty: true,
													});
													setTopicQuery(topic.name);
												}}
											>
												Usar {topic.name}
											</Button>
										))}
									</div>
								) : null}
								<FieldError errors={[form.formState.errors.topicId]} />
							</FieldContent>
						</Field>

						<Field orientation="vertical">
							<FieldLabel htmlFor="review-scoring-mode">Modo de pontuação</FieldLabel>
							<FieldContent>
								<Select
									onValueChange={(value) => {
										form.setValue("scoringMode", value as "exact" | "partial", {
											shouldDirty: true,
										});
										if (value === "exact") {
											form.setValue(
												"answers",
												form.getValues("answers").slice(0, 1),
												{ shouldDirty: true },
											);
										}
									}}
									defaultValue={form.getValues("scoringMode")}
								>
									<SelectTrigger id="review-scoring-mode">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="exact">Resposta única</SelectItem>
										<SelectItem value="partial">Respostas múltiplas</SelectItem>
									</SelectContent>
								</Select>
								<FieldError errors={[form.formState.errors.scoringMode]} />
							</FieldContent>
						</Field>
					</div>
				</ReviewSection>

				<ReviewSection
					testId="question-improvement-review-options-section"
					title="Alternativas"
					description="Troque o bloco inteiro e depois refine o que precisar, inclusive as corretas."
					currentLabel="Usar versão atual nas alternativas"
					suggestionLabel="Usar sugestão IA nas alternativas"
					onUseCurrent={() => useSnapshot(currentQuestion, "options")}
					onUseSuggestion={() => useSnapshot(suggestedQuestion, "options")}
					isMerge={hasOptionsChanges}
					comparison={
						hasOptionsChanges ? (
						<SectionComparison
							current={currentQuestion}
							suggested={suggestedQuestion}
							section="options"
						/>
						) : undefined
					}
				>
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<FieldTitle>Alternativas e corretas</FieldTitle>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={watchedOptions.length >= 10}
								onClick={handleAddOption}
							>
								Adicionar
							</Button>
						</div>
						{fields.map((field, index) => {
							const option = watchedOptions[index] ?? field;
							const textError = form.formState.errors.options?.[index]?.text;
							const isCorrect = watchedAnswers.includes(option.key);
							return (
								<div key={field.id} className="flex items-center gap-2">
									{watchedScoringMode === "exact" ? (
										<RadioGroup
											value={watchedAnswers[0] ?? ""}
											onValueChange={handleSelectAnswer}
											className="flex items-center"
										>
											<RadioGroupItem
												value={option.key}
												id={`review-correct-${option.key}`}
												aria-label={`Correta ${option.key.toLowerCase()}`}
											/>
										</RadioGroup>
									) : (
										<Checkbox
											id={`review-correct-${option.key}`}
											checked={isCorrect}
											onCheckedChange={(checked) =>
												handleToggleAnswer(option.key, checked === true)
											}
											aria-label={`Correta ${option.key.toLowerCase()}`}
										/>
									)}
									<span className="shrink-0 text-sm font-medium text-muted-foreground">
										{formatOptionKey(option.key)})
									</span>
									<div className="flex-1">
										<Input
											{...form.register(`options.${index}.text`)}
											aria-label={`Alternativa ${option.key}`}
											aria-invalid={textError ? true : undefined}
										/>
										{textError ? (
											<p className="mt-1 text-sm text-destructive">
												{textError.message}
											</p>
										) : null}
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="shrink-0 text-muted-foreground hover:text-destructive"
										disabled={watchedOptions.length <= 2}
										onClick={() => handleRemoveOption(index)}
										aria-label={`Remover alternativa ${option.key}`}
									>
										<XIcon className="h-4 w-4" />
									</Button>
								</div>
							);
						})}
						{form.formState.errors.answers ? (
							<p className="text-sm font-medium text-destructive">
								{form.formState.errors.answers.message}
							</p>
						) : null}
					</div>
				</ReviewSection>

				<ReviewSection
					testId="question-improvement-review-explanation-section"
					title="Explicação"
					description="Escolha a base e refine o texto curto que aparece junto da questão."
					currentLabel="Usar versão atual na explicação"
					suggestionLabel="Usar sugestão IA na explicação"
					onUseCurrent={() => useSnapshot(currentQuestion, "explanation")}
					onUseSuggestion={() => useSnapshot(suggestedQuestion, "explanation")}
					isMerge={hasExplanationChanges}
					comparison={
						hasExplanationChanges ? (
						<SectionComparison
							current={currentQuestion}
							suggested={suggestedQuestion}
							section="explanation"
						/>
						) : undefined
					}
				>
					<Field orientation="vertical">
						<FieldLabel htmlFor="review-explanation">Explicação</FieldLabel>
						<FieldContent>
							<Textarea
								id="review-explanation"
								rows={3}
								{...form.register("explanation")}
							/>
							<FieldError errors={[form.formState.errors.explanation]} />
						</FieldContent>
					</Field>
				</ReviewSection>

				<ReviewSection
					testId="question-improvement-review-deep-explanation-section"
					title="Explicação detalhada"
					description="Use a versão mais forte e ajuste só o que precisar para fechar a revisão."
					currentLabel="Usar versão atual na explicação detalhada"
					suggestionLabel="Usar sugestão IA na explicação detalhada"
					onUseCurrent={() => useSnapshot(currentQuestion, "deepExplanation")}
					onUseSuggestion={() => useSnapshot(suggestedQuestion, "deepExplanation")}
					isMerge={hasDeepExplanationChanges}
					comparison={
						hasDeepExplanationChanges ? (
						<SectionComparison
							current={currentQuestion}
							suggested={suggestedQuestion}
							section="deepExplanation"
						/>
						) : undefined
					}
				>
					<Field orientation="vertical">
						<FieldLabel htmlFor="review-deep-explanation">
							Explicação detalhada
						</FieldLabel>
						<FieldContent>
							<Textarea
								id="review-deep-explanation"
								rows={4}
								{...form.register("deepExplanation")}
							/>
							<FieldError errors={[form.formState.errors.deepExplanation]} />
						</FieldContent>
					</Field>
				</ReviewSection>
			</div>

			<div
				className={cn(
					"sticky bottom-4 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80",
				)}
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<p className="text-sm font-medium">Fechar revisão desta melhoria</p>
						<p className="text-sm text-muted-foreground">
							Aprovar salva a versão final montada aqui. Rejeitar descarta a sugestão atual.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button type="submit" disabled={isPending}>
							{isPending ? "Salvando..." : "Aprovar versão final"}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={isPending}
							onClick={onDiscard}
						>
							Rejeitar melhoria
						</Button>
					</div>
				</div>
			</div>
		</form>
	);
}

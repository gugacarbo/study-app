import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createQuestionTopicServerFn } from "@/functions/exams/create-question-topic";
import { searchQuestionTopics } from "@/functions/exams/search-question-topics";
import {
	RadioGroup,
	RadioGroupItem,
} from "@/components/ui/radio";
import {
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	questionFormSchema,
	type QuestionFormInput,
} from "@/features/exams/lib/question-form-schema";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { ArrowLeftRightIcon, MinusIcon, PlusIcon } from "lucide-react";

export type QuestionEditFormSubmission = QuestionFormInput & {
	topic: string | null;
};

type QuestionEditFormProps = {
	question: QuestionDetail;
	onSubmit: (data: QuestionEditFormSubmission) => void;
	onCancel: () => void;
	onDiscard?: () => void;
	submitLabel?: string;
	discardLabel?: string;
	isPending?: boolean;
	/**
	 * Versão original da questão. Quando fornecida junto de uma versão de
	 * melhoria em `question`, o formulário exibe botões de toggle ao lado dos
	 * campos alterados para alternar entre o estado atual e a sugestão.
	 */
	baseQuestion?: QuestionDetail;
};

function generateOptionKey(index: number): string {
	return String.fromCharCode(65 + index);
}

export function QuestionEditForm({
	question,
	baseQuestion,
	onSubmit,
	onCancel,
	onDiscard,
	submitLabel = "Salvar",
	discardLabel = "Rejeitar melhoria",
	isPending = false,
}: QuestionEditFormProps) {
	const form = useForm<QuestionFormInput>({
		resolver: zodResolver(questionFormSchema),
		defaultValues: {
			question: question.question,
			topicId: question.topicId ?? null,
			scoringMode: question.scoringMode,
			options: question.options,
			answers: question.answers,
			explanation: question.explanation ?? "",
			deepExplanation: question.deepExplanation ?? "",
		},
	});
	const [topicQuery, setTopicQuery] = useState(question.topic ?? "");
	const [topicResults, setTopicResults] = useState<
		Array<{
			topicId: string;
			name: string;
			normalizedName: string;
			similarityLabel:
				| "exact"
				| "normalized_exact"
				| "prefix"
				| "partial";
		}>
	>([]);
	const [isSearchingTopics, setIsSearchingTopics] = useState(false);
	const [isCreatingTopic, setIsCreatingTopic] = useState(false);

	const { fields, append, remove, replace } = useFieldArray({
		control: form.control,
		name: "options",
	});

	const watchedQuestion = useWatch({
		control: form.control,
		name: "question",
		defaultValue: question.question,
	});

	const watchedTopicId = useWatch({
		control: form.control,
		name: "topicId",
		defaultValue: question.topicId ?? null,
	});

	const watchedOptions = useWatch({
		control: form.control,
		name: "options",
		defaultValue: question.options,
	});

	const watchedAnswers = useWatch({
		control: form.control,
		name: "answers",
		defaultValue: question.answers,
	});

	const watchedScoringMode = useWatch({
		control: form.control,
		name: "scoringMode",
		defaultValue: question.scoringMode,
	});

	const watchedExplanation = useWatch({
		control: form.control,
		name: "explanation",
		defaultValue: question.explanation ?? "",
	});

	const watchedDeepExplanation = useWatch({
		control: form.control,
		name: "deepExplanation",
		defaultValue: question.deepExplanation ?? "",
	});

	const hasPendingImprovement = baseQuestion != null;

	function normalizeExplanation(
		value: string | null | undefined,
	): string | null {
		const trimmed = value?.trim();
		return trimmed || null;
	}

	function valuesEqual(a: unknown, b: unknown): boolean {
		return JSON.stringify(a) === JSON.stringify(b);
	}

	const isQuestionBase = hasPendingImprovement
		? watchedQuestion === baseQuestion.question
		: false;
	const hasQuestionChanges = hasPendingImprovement
		? baseQuestion.question !== question.question
		: false;

	const isTopicBase = hasPendingImprovement
		? watchedTopicId === baseQuestion.topicId &&
		  topicQuery.trim() === (baseQuestion.topic ?? "")
		: false;
	const hasTopicChanges = hasPendingImprovement
		? baseQuestion.topicId !== question.topicId ||
		  baseQuestion.topic !== question.topic
		: false;

	const isScoringBase = hasPendingImprovement
		? watchedScoringMode === baseQuestion.scoringMode
		: false;
	const hasScoringChanges = hasPendingImprovement
		? baseQuestion.scoringMode !== question.scoringMode
		: false;

	const isOptionsBase = hasPendingImprovement
		? valuesEqual(watchedOptions, baseQuestion.options) &&
		  valuesEqual(watchedAnswers, baseQuestion.answers)
		: false;
	const hasOptionsChanges = hasPendingImprovement
		? !valuesEqual(baseQuestion.options, question.options) ||
		  !valuesEqual(baseQuestion.answers, question.answers)
		: false;

	const isExplanationBase = hasPendingImprovement
		? normalizeExplanation(watchedExplanation) ===
		  normalizeExplanation(baseQuestion.explanation)
		: false;
	const hasExplanationChanges = hasPendingImprovement
		? normalizeExplanation(baseQuestion.explanation) !==
		  normalizeExplanation(question.explanation)
		: false;

	const isDeepExplanationBase = hasPendingImprovement
		? normalizeExplanation(watchedDeepExplanation) ===
		  normalizeExplanation(baseQuestion.deepExplanation)
		: false;
	const hasDeepExplanationChanges = hasPendingImprovement
		? normalizeExplanation(baseQuestion.deepExplanation) !==
		  normalizeExplanation(question.deepExplanation)
		: false;

	function toggleQuestion() {
		if (!baseQuestion) return;
		form.setValue(
			"question",
			isQuestionBase ? question.question : baseQuestion.question,
		);
	}

	function toggleTopic() {
		if (!baseQuestion) return;
		if (isTopicBase) {
			form.setValue("topicId", question.topicId ?? null);
			setTopicQuery(question.topic ?? "");
		} else {
			form.setValue("topicId", baseQuestion.topicId ?? null);
			setTopicQuery(baseQuestion.topic ?? "");
		}
		setTopicResults([]);
	}

	function toggleScoring() {
		if (!baseQuestion) return;
		const target = isScoringBase ? question : baseQuestion;
		form.setValue("scoringMode", target.scoringMode);
		form.setValue(
			"answers",
			target.scoringMode === "exact"
				? target.answers.slice(0, 1)
				: target.answers,
		);
	}

	function toggleOptions() {
		if (!baseQuestion) return;
		const target = isOptionsBase ? question : baseQuestion;
		replace(target.options.map((option) => ({ ...option })));
		form.setValue("answers", [...target.answers]);
	}

	function toggleExplanation() {
		if (!baseQuestion) return;
		form.setValue(
			"explanation",
			normalizeExplanation(
				isExplanationBase ? question.explanation : baseQuestion.explanation,
			) ?? "",
		);
	}

	function toggleDeepExplanation() {
		if (!baseQuestion) return;
		form.setValue(
			"deepExplanation",
			normalizeExplanation(
				isDeepExplanationBase
					? question.deepExplanation
					: baseQuestion.deepExplanation,
			) ?? "",
		);
	}

	function ImprovementToggle({
		label,
		hasChanges,
		isUsingBase,
		onClick,
	}: {
		label: string;
		hasChanges: boolean;
		isUsingBase: boolean;
		onClick: () => void;
	}) {
		if (!baseQuestion || !hasChanges) return null;

		return (
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-auto px-2 py-0 text-xs font-normal text-muted-foreground hover:text-foreground"
				onClick={onClick}
				disabled={isPending}
				aria-label={
					isUsingBase
						? `Usar melhoria ${label}`
						: `Usar versão atual ${label}`
				}
			>
				<ArrowLeftRightIcon className="size-3" />
				{isUsingBase ? "Usar melhoria" : "Usar atual"}
			</Button>
		);
	}

	function handleAddOption() {
		const currentOptions = form.getValues("options");
		if (currentOptions.length >= 10) return;
		append({
			key: generateOptionKey(currentOptions.length),
			text: "",
		});
	}

	function handleRemoveOption(index: number) {
		const currentOptions = form.getValues("options");
		if (currentOptions.length <= 2) return;

		const removedKey = currentOptions[index]?.key;
		remove(index);

		const currentAnswers = form.getValues("answers");
		if (removedKey && currentAnswers.includes(removedKey)) {
			form.setValue(
				"answers",
				currentAnswers.filter((key) => key !== removedKey),
			);
		}
	}

	function handleSelectAnswer(key: string) {
		form.setValue("answers", [key]);
	}

	function handleToggleAnswer(key: string, checked: boolean) {
		const currentAnswers = form.getValues("answers");

		if (watchedScoringMode === "exact") {
			form.setValue("answers", checked ? [key] : []);
			return;
		}

		if (checked) {
			form.setValue("answers", [...currentAnswers, key]);
		} else {
			form.setValue(
				"answers",
				currentAnswers.filter((answer) => answer !== key),
			);
		}
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
			form.setValue("topicId", result.topic.topicId);
			setTopicQuery(result.topic.name);
			setTopicResults([
				{
					...result.topic,
					similarityLabel: "normalized_exact",
				},
			]);
		} finally {
			setIsCreatingTopic(false);
		}
	}

	return (
		<form
			onSubmit={form.handleSubmit((data) =>
				onSubmit({
					...data,
					topic: topicQuery.trim() ? topicQuery.trim() : null,
				}),
			)}
			className="flex flex-col gap-4"
		>
			<Field orientation="vertical">
				<div className="flex items-center gap-2">
					<FieldLabel htmlFor="question">Enunciado</FieldLabel>
				<ImprovementToggle
					label="no enunciado"
					hasChanges={hasQuestionChanges}
					isUsingBase={isQuestionBase}
					onClick={toggleQuestion}
				/>
				</div>
				<FieldContent>
					<Textarea
						id="question"
						rows={3}
						{...form.register("question")}
					/>
					<FieldError errors={[form.formState.errors.question]} />
				</FieldContent>
			</Field>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Field orientation="vertical">
					<div className="flex items-center gap-2">
						<FieldLabel htmlFor="topic">Tópico</FieldLabel>
						<ImprovementToggle
							label="tópico"
							hasChanges={hasTopicChanges}
							isUsingBase={isTopicBase}
							onClick={toggleTopic}
						/>
					</div>
					<FieldContent className="gap-2">
						<Input
							id="topic"
							value={topicQuery}
							onChange={(event) => {
								setTopicQuery(event.target.value);
								form.setValue("topicId", null);
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
								{isSearchingTopics ? "Buscando…" : "Buscar"}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => void handleCreateTopic()}
								disabled={isCreatingTopic || isPending}
							>
								{isCreatingTopic ? "Criando…" : "Criar tópico"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									form.setValue("topicId", null);
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
											form.setValue("topicId", topic.topicId);
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
					<div className="flex items-center gap-2">
						<FieldLabel htmlFor="scoringMode">
							Modo de pontuação
						</FieldLabel>
						<ImprovementToggle
							label="modo de pontuação"
							hasChanges={hasScoringChanges}
							isUsingBase={isScoringBase}
							onClick={toggleScoring}
						/>
					</div>
					<FieldContent>
						<Select
							onValueChange={(value) => {
								form.setValue(
									"scoringMode",
									value as "exact" | "partial",
								);
								if (value === "exact") {
									const currentAnswers =
										form.getValues("answers");
									form.setValue(
										"answers",
										currentAnswers.slice(0, 1),
									);
								}
							}}
							defaultValue={form.getValues("scoringMode")}
						>
							<SelectTrigger id="scoringMode">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="exact">
									Resposta única
								</SelectItem>
								<SelectItem value="partial">
									Respostas múltiplas
								</SelectItem>
							</SelectContent>
						</Select>
						<FieldError
							errors={[form.formState.errors.scoringMode]}
						/>
					</FieldContent>
				</Field>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<FieldTitle>Alternativas</FieldTitle>
					<ImprovementToggle
						label="nas alternativas"
						hasChanges={hasOptionsChanges}
						isUsingBase={isOptionsBase}
						onClick={toggleOptions}
					/>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={watchedOptions.length >= 10}
						onClick={handleAddOption}
					>
						<PlusIcon className="mr-1 h-3 w-3" />
						Adicionar
					</Button>
				</div>
				{fields.map((field, index) => {
					const option = watchedOptions[index] ?? field;
					const textError = form.formState.errors.options?.[index]?.text;
					const isCorrect = watchedAnswers.includes(option.key);
					return (
						<div
							key={field.id}
							className="flex items-center gap-2"
						>
							{watchedScoringMode === "exact" ? (
								<RadioGroup
									value={watchedAnswers[0] ?? ""}
									onValueChange={handleSelectAnswer}
									className="flex items-center"
								>
									<RadioGroupItem
										value={option.key}
										id={`correct-${option.key}`}
										aria-label={`Correta ${option.key.toLowerCase()}`}
									/>
								</RadioGroup>
							) : (
								<Checkbox
									id={`correct-${option.key}`}
									checked={isCorrect}
									onCheckedChange={(checked) =>
										handleToggleAnswer(
											option.key,
											checked === true,
										)
									}
									aria-label={`Correta ${option.key.toLowerCase()}`}
								/>
							)}
							<span className="shrink-0 text-sm font-medium text-muted-foreground">
								{option.key.toLowerCase()})
							</span>
							<div className="flex-1">
								<Input
									{...form.register(`options.${index}.text`)}
									aria-label={`Alternativa ${option.key}`}
									aria-invalid={textError ? true : undefined}
								/>
								{textError && (
									<p className="mt-1 text-sm text-destructive">
										{textError.message}
									</p>
								)}
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
								<MinusIcon className="h-4 w-4" />
							</Button>
						</div>
					);
				})}
				{form.formState.errors.answers && (
					<p className="text-sm font-medium text-destructive">
						{form.formState.errors.answers.message}
					</p>
				)}
			</div>

			<Field orientation="vertical">
				<div className="flex items-center gap-2">
					<FieldLabel htmlFor="explanation">Explicação</FieldLabel>
					<ImprovementToggle
						label="explicação"
						hasChanges={hasExplanationChanges}
						isUsingBase={isExplanationBase}
						onClick={toggleExplanation}
					/>
				</div>
				<FieldContent>
					<Textarea
						id="explanation"
						rows={3}
						{...form.register("explanation")}
					/>
					<FieldError
						errors={[form.formState.errors.explanation]}
					/>
				</FieldContent>
			</Field>

			<Field orientation="vertical">
				<div className="flex items-center gap-2">
					<FieldLabel htmlFor="deepExplanation">
						Explicação detalhada
					</FieldLabel>
					<ImprovementToggle
						label="explicação detalhada"
						hasChanges={hasDeepExplanationChanges}
						isUsingBase={isDeepExplanationBase}
						onClick={toggleDeepExplanation}
					/>
				</div>
				<FieldContent>
					<Textarea
						id="deepExplanation"
						rows={3}
						{...form.register("deepExplanation")}
					/>
					<FieldError
						errors={[form.formState.errors.deepExplanation]}
					/>
				</FieldContent>
			</Field>

			<div className="flex flex-wrap gap-2">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Salvando…" : submitLabel}
				</Button>
				{onDiscard ? (
					<Button
						type="button"
						variant="outline"
						className="text-destructive hover:text-destructive"
						onClick={onDiscard}
						disabled={isPending}
					>
						{discardLabel}
					</Button>
				) : null}
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={isPending}
				>
					Cancelar
				</Button>
			</div>
		</form>
	);
}

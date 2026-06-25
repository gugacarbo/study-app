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
import { MinusIcon, PlusIcon } from "lucide-react";

type QuestionEditFormProps = {
	question: QuestionDetail;
	onSubmit: (data: QuestionFormInput) => void;
	onCancel: () => void;
	isPending?: boolean;
};

function generateOptionKey(index: number): string {
	return String.fromCharCode(65 + index);
}

export function QuestionEditForm({
	question,
	onSubmit,
	onCancel,
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

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "options",
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
			onSubmit={form.handleSubmit(onSubmit)}
			className="flex flex-col gap-4"
		>
			<Field orientation="vertical">
				<FieldLabel htmlFor="question">Enunciado</FieldLabel>
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
					<FieldLabel htmlFor="topic">Tópico</FieldLabel>
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
					<FieldLabel htmlFor="scoringMode">
						Modo de pontuação
					</FieldLabel>
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
					<FieldTitle>Alternativas</FieldTitle>
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
				<FieldLabel htmlFor="explanation">Explicação</FieldLabel>
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
				<FieldLabel htmlFor="deepExplanation">
					Explicação detalhada
				</FieldLabel>
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

			<div className="flex gap-2">
				<Button type="submit" disabled={isPending}>
					{isPending ? "Salvando…" : "Salvar"}
				</Button>
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

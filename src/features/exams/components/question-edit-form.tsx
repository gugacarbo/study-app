import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
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
			topic: question.topic ?? "",
			scoringMode: question.scoringMode,
			options: question.options,
			answers: question.answers,
			explanation: question.explanation ?? "",
			deepExplanation: question.deepExplanation ?? "",
		},
	});

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
					<FieldContent>
						<Input id="topic" {...form.register("topic")} />
						<FieldError errors={[form.formState.errors.topic]} />
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
				<FieldTitle>Alternativas</FieldTitle>
				{fields.map((field, index) => {
					const option = watchedOptions[index] ?? field;
					const textError = form.formState.errors.options?.[index]?.text;
					return (
						<div
							key={field.id}
							className="flex items-start gap-2"
						>
							<div className="pt-2 text-sm font-medium text-muted-foreground">
								{option.key.toLowerCase()})
							</div>
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
							<div className="flex items-center gap-2 pt-2">
								<Checkbox
									id={`correct-${option.key}`}
									checked={watchedAnswers.includes(option.key)}
									onCheckedChange={(checked) =>
										handleToggleAnswer(
											option.key,
											checked === true,
										)
									}
								/>
								<Label htmlFor={`correct-${option.key}`}>
									Correta
								</Label>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={watchedOptions.length <= 2}
								onClick={() => handleRemoveOption(index)}
							>
								Remover
							</Button>
						</div>
					);
				})}
				{form.formState.errors.answers && (
					<p className="text-sm font-medium text-destructive">
						{form.formState.errors.answers.message}
					</p>
				)}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="self-start"
					disabled={watchedOptions.length >= 10}
					onClick={handleAddOption}
				>
					Adicionar alternativa
				</Button>
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

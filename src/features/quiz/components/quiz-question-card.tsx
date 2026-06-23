import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import { Separator } from "@/components/ui/separator";
import type { QuizQuestion } from "@/features/quiz/types/quiz";

type QuizQuestionCardProps = {
	question: QuizQuestion;
	selectedOptionIds: string[];
	revealMode: "during" | "after";
	isRevealed: boolean;
	onToggleOption: (optionId: string, checked: boolean) => void;
	onSubmitAnswer: () => void;
	isSubmitting?: boolean;
};

function formatOptionKey(key: string): string {
	return key.toLowerCase();
}

export function QuizQuestionCard({
	question,
	selectedOptionIds,
	revealMode,
	isRevealed,
	onToggleOption,
	onSubmitAnswer,
	isSubmitting = false,
}: QuizQuestionCardProps) {
	const [localSelection, setLocalSelection] = useState<string[]>(
		selectedOptionIds,
	);

	const selectedSet = new Set(
		isRevealed && revealMode === "during" ? selectedOptionIds : localSelection,
	);
	const correctSet = new Set(question.correctOptionIds);
	const isMultiple = question.correctOptionIds.length > 1;

	function handleToggle(optionId: string, checked: boolean) {
		if (isRevealed && revealMode === "during") {
			return;
		}

		if (isMultiple) {
			const next = checked
				? [...localSelection, optionId]
				: localSelection.filter((id) => id !== optionId);
			setLocalSelection(next);
			onToggleOption(optionId, checked);
		} else {
			const next = checked ? [optionId] : [];
			setLocalSelection(next);
			onToggleOption(optionId, checked);
		}
	}

	const hasSelection = localSelection.length > 0;
	const showFeedback =
		isRevealed && revealMode === "during" && selectedOptionIds.length > 0;

	const answeredSelectedSet = new Set(selectedOptionIds);
	const isFullyCorrect =
		question.correctOptionIds.length > 0 &&
		question.correctOptionIds.every((id) => answeredSelectedSet.has(id)) &&
		selectedOptionIds.every((id) => correctSet.has(id));
	const isCorrect = showFeedback && selectedOptionIds.length > 0 ? isFullyCorrect : null;

	return (
		<Card className="flex flex-col gap-4">
			<CardContent className="flex flex-col gap-4 pt-6">
				<div className="flex items-start justify-between gap-3">
					<p className="text-base leading-relaxed">{question.question}</p>
					{question.topic ? (
						<Badge variant="secondary">{question.topic}</Badge>
					) : null}
				</div>

				{isMultiple ? (
					<div className="flex flex-col gap-3" role="group" aria-label="Alternativas">
						{question.options.map((option) => {
							const isSelected = selectedSet.has(option.id);
							const isCorrectOption = correctSet.has(option.id);
							const showCorrectness = showFeedback && isCorrectOption;
							const showIncorrectness =
								showFeedback && isSelected && !isCorrectOption;

							return (
								<div
									key={option.id}
									className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
										showCorrectness
											? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
											: showIncorrectness
												? "border-red-300 bg-red-50/50 dark:bg-red-950/20"
												: "border-input hover:bg-muted/30"
									}`}
								>
									<Checkbox
										id={`option-${option.id}`}
										checked={isSelected}
										onCheckedChange={(checked) =>
											handleToggle(option.id, checked === true)
										}
										disabled={showFeedback}
										aria-label={`Alternativa ${formatOptionKey(
											option.id,
										)}`}
									/>
									<Label
										htmlFor={`option-${option.id}`}
										className="flex-1 cursor-pointer text-sm leading-snug"
									>
										<span className="font-medium tabular-nums">
											{formatOptionKey(option.id)})
										</span>{" "}
										{option.text}
									</Label>
								</div>
							);
						})}
					</div>
				) : (
					<RadioGroup
						value={localSelection[0] ?? ""}
						onValueChange={(value) => {
							if (!value) return;
							setLocalSelection([value]);
							onToggleOption(value, true);
						}}
						disabled={showFeedback}
						className="flex flex-col gap-3"
						role="radiogroup"
						aria-label="Alternativas"
					>
						{question.options.map((option) => {
							const isSelected = selectedSet.has(option.id);
							const isCorrectOption = correctSet.has(option.id);
							const showCorrectness = showFeedback && isCorrectOption;
							const showIncorrectness =
								showFeedback && isSelected && !isCorrectOption;

							return (
								<div
									key={option.id}
									className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
										showCorrectness
											? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
											: showIncorrectness
												? "border-red-300 bg-red-50/50 dark:bg-red-950/20"
												: "border-input hover:bg-muted/30"
										}`}
								>
									<RadioGroupItem
										value={option.id}
										id={`option-${option.id}`}
										disabled={showFeedback}
										aria-label={`Alternativa ${formatOptionKey(
											option.id,
										)}`}
									/>
									<Label
										htmlFor={`option-${option.id}`}
										className="flex-1 cursor-pointer text-sm leading-snug"
									>
										<span className="font-medium tabular-nums">
											{formatOptionKey(option.id)})
										</span>{" "}
										{option.text}
									</Label>
								</div>
							);
						})}
					</RadioGroup>
				)}

				{showFeedback ? (
					<div className="rounded-lg border bg-muted/30 p-3">
						{isCorrect === true ? (
							<Badge
								variant="default"
								className="mb-2 bg-emerald-500 text-white"
							>
								Resposta correta
							</Badge>
							) : isCorrect === false ? (
							<Badge
								variant="destructive"
								className="mb-2"
							>
								Resposta incorreta
							</Badge>
							) : null}
						{question.explanation ? (
							<p className="text-sm text-muted-foreground">
								{question.explanation}
							</p>
							) : null}
					</div>
				) : null}
			</CardContent>

			{revealMode === "during" && !isRevealed ? (
				<>
					<Separator />
					<CardFooter className="justify-end">
						<Button
							onClick={onSubmitAnswer}
							disabled={!hasSelection || isSubmitting}
						>
							{isSubmitting ? "Enviando…" : "Confirmar resposta"}
						</Button>
					</CardFooter>
				</>
			) : null}
		</Card>
	);
}

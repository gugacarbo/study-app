import { useEffect, useState, type WheelEvent } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio";
import { Separator } from "@/components/ui/separator";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";
import type { QuestionInAttempt } from "@/features/quiz/types/quiz";

type QuizQuestionCardProps = {
	question: QuestionInAttempt;
	currentIndex: number;
	total: number;
	score: number;
	selectedOptionIds: string[];
	activeOptionId: string | null;
	revealMode: "during" | "after";
	isRevealed: boolean;
	credit?: number;
	canGoNext?: boolean;
	onToggleOption: (optionId: string, checked: boolean) => void;
	onCycleOptions: (direction: "up" | "down") => void;
	onSubmitAnswer: () => void;
	onNext?: () => void;
	isSubmitting?: boolean;
};

function formatOptionKey(key: string): string {
	return key.toUpperCase();
}

function formatScore(score: number): string {
	return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatCredit(credit: number): string {
	return Number.isInteger(credit) ? String(credit) : credit.toFixed(1);
}

export function QuizQuestionCard({
	question,
	currentIndex,
	total,
	score,
	selectedOptionIds,
	activeOptionId,
	revealMode,
	isRevealed,
	credit,
	onToggleOption,
	onCycleOptions,
	onSubmitAnswer,
	isSubmitting = false,
}: QuizQuestionCardProps) {
	const [localSelection, setLocalSelection] = useState<string[]>(
		selectedOptionIds,
	);

	useEffect(() => {
		setLocalSelection(selectedOptionIds);
	}, [question.id, selectedOptionIds]);

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
	const partialCredit =
		showFeedback && credit !== undefined && credit > 0 && credit < 1 && !isFullyCorrect;

	function handleWheel(event: WheelEvent) {
		if (showFeedback) return;
		if (event.deltaY === 0) return;

		event.preventDefault();
		onCycleOptions(event.deltaY > 0 ? "down" : "up");
	}

	return (
		<Card className="border border-border/70 bg-card/95 shadow-sm shadow-black/5">
			<CardContent className="flex flex-col gap-4 pt-6">
				<div className="flex justify-between">
					<span className="text-sm text-muted-foreground">
						Questão{" "}
						<span className="font-medium text-foreground">{currentIndex + 1}</span>{" "}
						de <span className="font-medium text-foreground">{total}</span>
					</span>
					<span className="text-sm text-emerald-500">
						Score: {formatScore(score)}
					</span>
				</div>

				<div className="flex items-start justify-between gap-3">
					<div className="text-lg font-semibold leading-snug">
						<MarkdownRenderer content={question.question} />
					</div>
					{question.topic ? (
						<Badge variant="secondary">{question.topic}</Badge>
					) : null}
				</div>

				{isMultiple ? (
					<p className="text-xs text-muted-foreground">
						Selecione todas as alternativas corretas.
					</p>
				) : null}

				{isMultiple ? (
					<div
						className="flex flex-col gap-2"
						role="group"
						aria-label="Alternativas"
						onWheel={handleWheel}
					>
						{question.options.map((option) => {
							const isSelected = selectedSet.has(option.id);
							const isCorrectOption = correctSet.has(option.id);
							const isActiveOption = activeOptionId === option.id;
							const showCorrectness = showFeedback && isCorrectOption;
							const showIncorrectness =
								showFeedback && isSelected && !isCorrectOption;

							return (
								<label
									key={option.id}
									className={cn(
										"flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
										showCorrectness
											? "border-emerald-500 bg-emerald-500/10"
											: showIncorrectness
												? "border-red-400 bg-red-50 dark:bg-red-950/20"
												: isActiveOption || isSelected
													? "border-primary bg-primary/10"
													: "border-border hover:bg-muted/40",
									)}
								>
									<Checkbox
										id={`option-${option.id}`}
										checked={isSelected}
										onCheckedChange={(checked) =>
											handleToggle(option.id, checked === true)
										}
										disabled={showFeedback}
										className="mt-0.5 shrink-0"
										aria-label={`Alternativa ${formatOptionKey(
											option.id,
										)}`}
									/>
									<span className="mr-1 shrink-0 text-sm font-bold tabular-nums">
										{formatOptionKey(option.id)})
									</span>
									<MarkdownRenderer
										content={option.text}
										className="flex-1 text-sm leading-snug"
									/>
								</label>
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
						className="flex flex-col gap-2"
						role="radiogroup"
						aria-label="Alternativas"
						onWheel={handleWheel}
					>
						{question.options.map((option) => {
							const isSelected = selectedSet.has(option.id);
							const isCorrectOption = correctSet.has(option.id);
							const isActiveOption = activeOptionId === option.id;
							const showCorrectness = showFeedback && isCorrectOption;
							const showIncorrectness =
								showFeedback && isSelected && !isCorrectOption;

							return (
								<div
									key={option.id}
									className={cn(
										"flex items-start gap-3 rounded-md border px-3 py-2 transition-colors",
										showCorrectness
											? "border-emerald-500 bg-emerald-500/10"
											: showIncorrectness
												? "border-red-400 bg-red-50 dark:bg-red-950/20"
												: isActiveOption || isSelected
													? "border-primary bg-primary/10"
													: "border-border hover:bg-muted/40",
									)}
								>
									<RadioGroupItem
										value={option.id}
										id={`option-${option.id}`}
										disabled={showFeedback}
										aria-label={`Alternativa ${formatOptionKey(
											option.id,
										)}`}
										className="mt-0.5 shrink-0"
									/>
									<Label
										htmlFor={`option-${option.id}`}
										className="flex-1 cursor-pointer text-sm leading-snug"
									>
										<span className="mr-1 font-bold tabular-nums">
											{formatOptionKey(option.id)})
										</span>{" "}
										<MarkdownRenderer
											content={option.text}
											className="text-left"
										/>
									</Label>
								</div>
							);
						})}
					</RadioGroup>
				)}

				{showFeedback ? (
					<div className="rounded-md border border-border/70 bg-muted/20 p-3">
						<Badge
							variant={
								isCorrect
									? "default"
									: partialCredit
										? "secondary"
										: "destructive"
							}
							className={cn(
								"mb-2",
								isCorrect && "bg-emerald-500 text-white hover:bg-emerald-500",
							)}
						>
							{isCorrect
								? "✓ Resposta correta"
								: partialCredit
								? `Crédito parcial (${formatCredit(credit ?? 0)})`
								: "✗ Resposta incorreta"}
						</Badge>
					</div>
				) : null}

				{showFeedback &&
				(question.explanation || question.deepExplanation) ? (
					<section
						aria-labelledby={`question-${question.id}-explanation-title`}
						className="rounded-md border border-border/70 bg-card p-4"
					>
						<h2
							id={`question-${question.id}-explanation-title`}
							className="mb-2 text-sm font-semibold text-foreground"
						>
							Explicação da questão
						</h2>
						{question.explanation ? (
							<MarkdownRenderer
								content={question.explanation}
								className="text-sm leading-relaxed text-muted-foreground"
							/>
						) : null}
						{question.deepExplanation ? (
							<Accordion type="single" collapsible className="mt-3">
								<AccordionItem
									value="deep-explanation"
									className="rounded-md border border-border px-3"
								>
									<AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline">
										Ver explicação completa
									</AccordionTrigger>
									<AccordionContent className="border-t pt-3 text-sm text-muted-foreground">
										<MarkdownRenderer content={question.deepExplanation} />
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						) : null}
					</section>
				) : null}

				{!showFeedback ? (
					<p className="text-xs text-muted-foreground">
						Hotkeys: 1-{Math.min(question.options.length, 9)} para{" "}
						{isMultiple ? "marcar/desmarcar" : "selecionar"}, Enter para confirmar
					</p>
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
							{isSubmitting ? "Enviando…" : "Confirmar resposta (Enter)"}
						</Button>
					</CardFooter>
				</>
			) : null}
		</Card>
	);
}

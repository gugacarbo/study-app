import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { isOptionCorrect } from "@/lib/answer-scoring";
import { cn } from "@/lib/utils";
import type { Question } from "@/lib/validation";

export interface QuestionWithId extends Question {
	id: number;
}

interface QuizQuestionProps {
	question: QuestionWithId;
	currentIndex: number;
	total: number;
	score: number;
	selectedAnswers: string[];
	showExplanation: boolean;
	isPending: boolean;
	onSubmit: () => void;
	onSelectAnswer: (answer: string) => void;
	onToggleAnswer: (answer: string) => void;
	submitError: string | null;
}

function formatScore(score: number): string {
	return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function QuizQuestion({
	question,
	currentIndex,
	total,
	score,
	selectedAnswers,
	showExplanation,
	isPending,
	onSubmit,
	onSelectAnswer,
	onToggleAnswer,
	submitError,
}: QuizQuestionProps) {
	const isMultiAnswer = question.answers.length > 1;
	const canSubmit = selectedAnswers.length > 0;

	return (
		<>
			<div className="flex justify-between mb-4">
				<span className="text-muted-foreground">
					Question {currentIndex + 1} of {total}
				</span>
				<span className="text-success">Score: {formatScore(score)}</span>
			</div>

			<div className="text-lg font-semibold mb-4">
				<MarkdownRenderer content={question.question} />
			</div>

			{isMultiAnswer && (
				<p className="mb-2 text-xs text-muted-foreground">
					Selecione todas as alternativas corretas.
				</p>
			)}

			<div className="flex flex-col gap-2">
				{question.options.map((option: string, i: number) => {
					const letter = String.fromCharCode(97 + i);
					const isSelected = isOptionCorrect(option, selectedAnswers);

					if (isMultiAnswer) {
						return (
							<label
								key={option}
								className={cn(
									"flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
									isSelected
										? "border-primary bg-primary/10"
										: "border-border hover:bg-muted/40",
								)}
							>
								<input
									type="checkbox"
									checked={isSelected}
									onChange={() => onToggleAnswer(option)}
									disabled={showExplanation}
									className="mt-1 shrink-0 accent-primary"
									aria-label={`Select option ${letter}`}
								/>
								<span className="mr-1 font-bold shrink-0">{letter})</span>
								<MarkdownRenderer content={option} className="text-left" />
							</label>
						);
					}

					return (
						<Button
							key={option}
							variant={isSelected ? "default" : "outline"}
							className="justify-start h-auto py-2 whitespace-normal break-words text-left [&_p]:m-0"
							onClick={() => onSelectAnswer(option)}
							disabled={showExplanation}
						>
							<span className="mr-2 font-bold shrink-0">{letter})</span>
							<MarkdownRenderer content={option} className="text-left" />
						</Button>
					);
				})}
			</div>

			{!showExplanation && (
				<>
					<Button
						className="w-full mt-4"
						disabled={!canSubmit || isPending}
						onClick={onSubmit}
					>
						{isPending ? "Submitting..." : "Submit Answer (Enter)"}
					</Button>
					{submitError && (
						<p className="text-destructive text-sm mt-2">{submitError}</p>
					)}
				</>
			)}

			<div className="mt-4 text-xs text-muted-foreground">
				Hotkeys: 1-{question.options.length} to{" "}
				{isMultiAnswer ? "toggle" : "select"} answer, Enter to submit/next
			</div>
		</>
	);
}

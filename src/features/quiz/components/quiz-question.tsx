import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import type { Question } from "@/lib/validation";

export interface QuestionWithId extends Question {
	id: number;
}

interface QuizQuestionProps {
	question: QuestionWithId;
	currentIndex: number;
	total: number;
	score: number;
	selectedAnswer: string | null;
	showExplanation: boolean;
	isPending: boolean;
	onSubmit: () => void;
	onSelectAnswer: (answer: string) => void;
	submitError: string | null;
}

export function QuizQuestion({
	question,
	currentIndex,
	total,
	score,
	selectedAnswer,
	showExplanation,
	isPending,
	onSubmit,
	onSelectAnswer,
	submitError,
}: QuizQuestionProps) {
	return (
		<>
			<div className="flex justify-between mb-4">
				<span className="text-muted-foreground">
					Question {currentIndex + 1} of {total}
				</span>
				<span className="text-success">Score: {score}</span>
			</div>

			<div className="text-lg font-semibold mb-4">
				<MarkdownRenderer content={question.question} />
			</div>

			<div className="flex flex-col gap-2">
				{question.options.map((option: string, i: number) => (
					<Button
						key={option}
						variant={selectedAnswer === option ? "default" : "outline"}
						className="justify-start h-auto py-2 whitespace-normal break-words text-left [&_p]:m-0"
						onClick={() => onSelectAnswer(option)}
					>
						<span className="mr-2 font-bold shrink-0">
							{String.fromCharCode(97 + i)})
						</span>
						<MarkdownRenderer content={option} className="text-left" />
					</Button>
				))}
			</div>

			{!showExplanation && (
				<>
					<Button
						className="w-full mt-4"
						disabled={!selectedAnswer || isPending}
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
				Hotkeys: 1-4 to select answer, Enter to submit/next
			</div>
		</>
	);
}

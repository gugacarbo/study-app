import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";

interface QuizExplanationProps {
	isCorrect: boolean;
	credit?: number;
	explanation: string;
	longExplanation: string;
	onNext: () => void;
}

function formatCredit(credit: number): string {
	return Number.isInteger(credit) ? String(credit) : credit.toFixed(1);
}

export function QuizExplanation({
	isCorrect,
	credit,
	explanation,
	longExplanation,
	onNext,
}: QuizExplanationProps) {
	const partialCredit =
		credit !== undefined && credit > 0 && credit < 1 && !isCorrect;

	return (
		<div className="mt-4">
			<Badge
				variant={isCorrect ? "default" : partialCredit ? "secondary" : "destructive"}
				className="mb-2"
			>
				{isCorrect
					? "✓ Correct!"
					: partialCredit
						? `Partial credit (${formatCredit(credit)})`
						: "✗ Incorrect"}
			</Badge>
			<MarkdownRenderer content={explanation} className="text-sm" />
			{longExplanation && (
				<details className="mt-2 rounded-lg border border-border p-3">
					<summary className="cursor-pointer text-sm font-medium text-muted-foreground">
						Ver explicação completa
					</summary>
					<div className="mt-2 text-sm text-muted-foreground">
						<MarkdownRenderer content={longExplanation} />
					</div>
				</details>
			)}
			<Button className="mt-2" onClick={onNext}>
				Next Question (Enter)
			</Button>
		</div>
	);
}

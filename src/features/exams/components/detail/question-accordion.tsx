import type { ImproveQuestionsRunPhase } from "@/features/background-processes";
import { Loader2, Pencil, Sparkles } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { isOptionCorrect } from "@/lib/answer-scoring";
import { cn } from "@/lib/utils";
import type { QuestionData } from "./exam-utils";

interface QuestionAccordionProps {
	question: QuestionData;
	onStartEdit: (q: QuestionData) => void;
	onImproveQuestions: (q: QuestionData) => void;
	improveQuestionsStatus?: ImproveQuestionsRunPhase | null;
}

function improveQuestionsStatusLabel(
	status: ImproveQuestionsRunPhase,
): string | null {
	if (status === "running") return "Improving question…";
	if (status === "done") return "Review improvements";
	return null;
}

export function QuestionAccordion({
	question,
	onStartEdit,
	onImproveQuestions,
	improveQuestionsStatus = null,
}: QuestionAccordionProps) {
	const statusLabel = improveQuestionsStatus
		? improveQuestionsStatusLabel(improveQuestionsStatus)
		: null;
	const isRunning = improveQuestionsStatus === "running";

	return (
		<div className="pt-2">
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
				{statusLabel && (
					<Badge
						variant="outline"
						className="w-fit gap-1 self-start border-primary/40 text-primary sm:self-auto"
					>
						{isRunning && <Loader2 className="size-3 animate-spin" />}
						{statusLabel}
					</Badge>
				)}
				<div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
					<Button
						variant="outline"
						size="sm"
						className="min-h-10 sm:min-h-8"
						onClick={() => onImproveQuestions(question)}
					>
						<Sparkles className="size-3.5" />
						<span className="truncate">Improve</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="min-h-10 sm:min-h-8"
						onClick={() => onStartEdit(question)}
					>
						<Pencil className="size-3.5" />
						Edit
					</Button>
				</div>
			</div>

			<div className="mt-2 flex flex-col gap-2 sm:mt-1 sm:gap-1.5">
				{question.options.map((opt, optIdx) => {
					const letter = String.fromCharCode(65 + optIdx);
					const isCorrect = isOptionCorrect(opt, question.answers);
					return (
						<div
							key={`${question.id}:${letter}:${opt}`}
							className={cn(
								"flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-start sm:gap-2.5 sm:p-2.5",
								isCorrect
									? "border-2 border-success bg-success/5"
									: "border-border/50 bg-muted/30",
							)}
						>
							<div className="flex min-w-0 items-start gap-2.5">
								<span
									className={cn(
										"flex size-6 shrink-0 items-center justify-center rounded border bg-card text-xs font-bold sm:size-5 sm:text-[11px]",
										isCorrect
											? "border-success/60 text-success"
											: "border-border text-muted-foreground",
									)}
								>
									{letter}
								</span>
								<span className="min-w-0 flex-1">
									<MarkdownRenderer content={opt} />
								</span>
							</div>
							{isCorrect && (
								<Badge
									variant="outline"
									className="w-fit shrink-0 border-success/50 text-success sm:mt-0.5"
								>
									Correct
								</Badge>
							)}
						</div>
					);
				})}
			</div>

			{(question.explanation || question.deepExplanation) && (
				<Accordion
					type="multiple"
					className="mt-3 gap-1.5 rounded-none border-0"
				>
					{question.explanation && (
						<AccordionItem
							value="explanation"
							className="overflow-hidden rounded-md border"
						>
							<AccordionTrigger className="px-3 py-2 hover:no-underline">
								Explanation
							</AccordionTrigger>
							<AccordionContent className="px-3 text-sm">
								<MarkdownRenderer content={question.explanation} />
							</AccordionContent>
						</AccordionItem>
					)}
					{question.deepExplanation && (
						<AccordionItem
							value="deep-explanation"
							className="overflow-hidden rounded-md border"
						>
							<AccordionTrigger className="px-3 py-2 hover:no-underline">
								Deep Explanation
							</AccordionTrigger>
							<AccordionContent className="px-3 text-sm">
								<MarkdownRenderer content={question.deepExplanation} />
							</AccordionContent>
						</AccordionItem>
					)}
				</Accordion>
			)}
		</div>
	);
}

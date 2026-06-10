import { Pencil, Sparkles } from "lucide-react";
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
	onImproveOptions: (q: QuestionData) => void;
}

export function QuestionAccordion({
	question,
	onStartEdit,
	onImproveOptions,
}: QuestionAccordionProps) {
	return (
		<div className="pt-2">
			<div className="flex justify-end gap-1">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onImproveOptions(question)}
				>
					<Sparkles className="size-3.5" />
					Improve Options
				</Button>
				<Button variant="ghost" size="sm" onClick={() => onStartEdit(question)}>
					<Pencil className="size-3.5" />
					Edit
				</Button>
			</div>

			<div className="mt-1 flex flex-col gap-1.5">
				{question.options.map((opt, optIdx) => {
					const letter = String.fromCharCode(65 + optIdx);
					const isCorrect = isOptionCorrect(opt, question.answers);
					return (
						<div
							key={`${question.id}:${letter}:${opt}`}
							className={cn(
								"flex items-start gap-2.5 rounded-md border p-2.5 text-sm",
								isCorrect
									? "border-2 border-success bg-success/5"
									: "border-border/50 bg-muted/30",
							)}
						>
							<span
								className={cn(
									"flex size-5 shrink-0 items-center justify-center rounded border bg-card text-[11px] font-bold",
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
							{isCorrect && (
								<Badge
									variant="outline"
									className="mt-0.5 shrink-0 border-success/50 text-success"
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

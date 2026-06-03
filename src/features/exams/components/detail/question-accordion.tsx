import { CheckCircle2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";
import type { QuestionData } from "./exam-utils";

interface QuestionAccordionProps {
	question: QuestionData;
	index: number;
	isExpanded: boolean;
	onToggle: (id: number) => void;
	onStartEdit: (q: QuestionData) => void;
}

export function QuestionAccordion({
	question,
	index,
	isExpanded,
	onToggle,
	onStartEdit,
}: QuestionAccordionProps) {
	return (
		<div className="rounded-lg border border-border overflow-hidden">
			<button
				type="button"
				onClick={() => onToggle(question.id)}
				className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted transition-colors"
			>
				<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
					{index + 1}
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm leading-relaxed line-clamp-2">
						{question.question}
					</p>
					{question.topic && (
						<Badge variant="secondary" className="mt-1">
							{question.topic}
						</Badge>
					)}
				</div>
				<div className="shrink-0 mt-0.5">
					{isExpanded ? (
						<ChevronUp className="size-4 text-muted-foreground" />
					) : (
						<ChevronDown className="size-4 text-muted-foreground" />
					)}
				</div>
			</button>

			{isExpanded && (
				<div className="px-3 pb-3 pt-0 border-t border-border">
					<div className="flex justify-end mt-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onStartEdit(question)}
						>
							<Pencil className="size-3.5" />
							Edit
						</Button>
					</div>

					<div className="flex flex-col gap-1.5">
						{question.options.map((opt, optIdx) => {
							const letter = String.fromCharCode(65 + optIdx);
							const isCorrect = opt === question.answer;
							return (
								<div
									key={`${question.id}:${letter}:${opt}`}
									className={cn(
										"flex items-start gap-2.5 rounded-lg p-2.5 text-sm",
										isCorrect
											? "bg-success/10 border border-success/30"
											: "bg-muted",
									)}
								>
									<span
										className={cn(
											"flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-bold",
											isCorrect
												? "bg-success text-primary-foreground"
												: "bg-card text-muted-foreground",
										)}
									>
										{letter}
									</span>
									<span className="flex-1">
										<MarkdownRenderer content={opt} />
									</span>
									{isCorrect && (
										<CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
									)}
								</div>
							);
						})}
					</div>

					{question.explanation && (
						<div className="mt-3 rounded-lg bg-muted p-3 text-sm">
							<p className="text-xs font-semibold text-muted-foreground mb-1">
								Explanation
							</p>
							<MarkdownRenderer content={question.explanation} />
						</div>
					)}

					{question.deepExplanation && (
						<div className="mt-3 rounded-lg bg-muted p-3 text-sm">
							<p className="text-xs font-semibold text-muted-foreground mb-1">
								Deep Explanation
							</p>
							<MarkdownRenderer content={question.deepExplanation} />
						</div>
					)}
				</div>
			)}
		</div>
	);
}

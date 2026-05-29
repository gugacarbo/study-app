import { ChevronDown, ChevronUp, Pencil, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { MarkdownRenderer } from "../ui/markdown";
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
				<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
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
						<ChevronUp className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
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
							<Pencil className="h-3.5 w-3.5" />
							Edit
						</Button>
					</div>

					<div className="space-y-1.5">
						{question.options.map((opt, optIdx) => {
							const letter = String.fromCharCode(65 + optIdx);
							const isCorrect = opt === question.answer;
							return (
								<div
									key={optIdx}
									className={`flex items-start gap-2.5 rounded-lg p-2.5 text-sm ${
										isCorrect
											? "bg-success/10 border border-success/30"
											: "bg-muted"
									}`}
								>
									<span
										className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
											isCorrect
												? "bg-success text-primary-foreground"
												: "bg-card text-muted-foreground"
										}`}
									>
										{letter}
									</span>
									<span className="flex-1">
										<MarkdownRenderer content={opt} />
									</span>
									{isCorrect && (
										<CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
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

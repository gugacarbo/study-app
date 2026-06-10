import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown";
import type { QuestionData } from "@/features/exams/components/detail/exam-utils";
import { isOptionCorrect } from "@/lib/answer-scoring";
import { cn } from "@/lib/utils";

interface QuestionPreviewPanelProps {
	question: QuestionData;
}

export function QuestionPreviewPanel({ question }: QuestionPreviewPanelProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
			<p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Question preview
			</p>
			<div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
				<p className="mb-3 text-sm leading-relaxed">{question.question}</p>

				<div className="flex flex-col gap-1.5">
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

				{question.explanation && (
					<div className="mt-3 rounded-md border p-3">
						<p className="mb-1 text-xs font-semibold text-muted-foreground">
							Explanation
						</p>
						<div className="text-sm">
							<MarkdownRenderer content={question.explanation} />
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

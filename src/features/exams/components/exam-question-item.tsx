import type { QuestionImprovementDraftRecord } from "@/db/queries/question-improvement-drafts";
import {
	CheckCircle2Icon,
	FileTextIcon,
	SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown";
import type { QuestionDetail } from "@/features/exams/types/exam-detail";
import { cn } from "@/lib/utils";

type ExamQuestionItemProps = {
	index: number;
	question: QuestionDetail;
	draft?: QuestionImprovementDraftRecord;
};

function formatTopic(topic: string | null): string {
	return topic ?? "Geral";
}

function formatOptionKey(key: string): string {
	return key.toLowerCase();
}

function formatScoringMode(scoringMode: QuestionDetail["scoringMode"]): string {
	return scoringMode === "partial" ? "Respostas múltiplas" : "Resposta única";
}

export function ExamQuestionItem({
	index,
	question,
	draft,
}: ExamQuestionItemProps) {
	const answerSet = new Set(question.answers);

	return (
		<div data-testid="question-main-panel">
			<div data-testid="question-page-main" className="space-y-4">
				<section className="rounded-xl border bg-card p-5 text-card-foreground shadow-xs">
					<div className="flex flex-col gap-5">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="space-y-2">
								<p className="text-sm font-medium text-muted-foreground">
									Q{index} · {formatTopic(question.topic)}
								</p>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline">
										{formatScoringMode(question.scoringMode)}
									</Badge>
									<Badge variant="secondary">
										<FileTextIcon data-icon="inline-start" />
										{question.options.length} alternativas
									</Badge>
								</div>
							</div>
							{draft ? (
								<Badge variant="secondary">
									<SparklesIcon data-icon="inline-start" />
									Melhoria pendente
								</Badge>
							) : null}
						</div>

						<div className="text-sm leading-7">
							<MarkdownRenderer content={question.question} />
						</div>

						<ul className="flex flex-col gap-2" data-testid="question-options">
							{question.options.map((option) => {
								const isCorrect = answerSet.has(option.key);
								return (
									<li
										key={option.key}
										className={cn(
											"flex items-start gap-3 rounded-lg border px-3 py-3 text-sm",
											isCorrect
												? "border-emerald-500/60 bg-emerald-50 text-foreground shadow-xs dark:bg-emerald-950/20"
												: "border-border/70 bg-background text-muted-foreground",
										)}
									>
										<span
											className={cn(
												"font-medium tabular-nums",
												isCorrect
													? "text-emerald-700 dark:text-emerald-300"
													: "",
											)}
										>
											{formatOptionKey(option.key)})
										</span>
										<span className="min-w-0 flex-1">{option.text}</span>
										{isCorrect ? (
											<Badge variant="secondary" className="self-center">
												<CheckCircle2Icon data-icon="inline-start" />
												Correta
											</Badge>
										) : null}
									</li>
								);
							})}
						</ul>
					</div>
				</section>
			</div>
		</div>
	);
}
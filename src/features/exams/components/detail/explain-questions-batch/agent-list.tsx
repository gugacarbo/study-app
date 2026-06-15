import { Play, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AgentRunState } from "@/features/ai/utils/agent-run-messages";
import {
	type ExplainQuestionsBatchAgentItem,
	canContinueExplainQuestionsAgent,
	explainQuestionsAgentBadgeClass,
} from "./types";

interface ExplainQuestionsAgentListProps {
	agentItems: ExplainQuestionsBatchAgentItem[];
	finishedCount: number;
	processingCount: number;
	errorCount: number;
	progressPercent: number;
	onAgentClick: (questionId: number) => void;
	onContinue: (questionId: number) => void;
}

export function ExplainQuestionsAgentList({
	agentItems,
	finishedCount,
	processingCount,
	errorCount,
	progressPercent,
	onAgentClick,
	onContinue,
}: ExplainQuestionsAgentListProps) {
	if (agentItems.length === 0) return null;

	return (
		<div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card p-3">
			<div className="mb-2 flex shrink-0 items-center justify-between text-xs">
				<span className="font-semibold text-muted-foreground">
					Agentes em execucao
				</span>
				<span className="text-muted-foreground">
					{finishedCount}/{agentItems.length} ({progressPercent}%)
				</span>
			</div>
			<Progress value={progressPercent} className="mb-2 h-2 shrink-0" />
			<div className="mb-2 shrink-0 text-xs text-muted-foreground">
				{processingCount > 0 && `${processingCount} processando`}
				{processingCount > 0 && errorCount > 0 && " • "}
				{errorCount > 0 && `${errorCount} com erro`}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-muted p-2">
				<div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground/80">
					<Sparkles className="size-3.5 text-sky-500 dark:text-sky-300" />
					Agentes
				</div>
				<div className="grid gap-1.5">
					{agentItems.map((item) => {
						const canContinue = canContinueExplainQuestionsAgent(item);

						return (
							<div
								key={item.processView.questionId}
								className="flex items-center gap-2 rounded-md border border-border bg-accent px-2.5 py-1.5"
							>
								<button
									type="button"
									onClick={() => onAgentClick(item.question.id)}
									className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-sky-600 dark:hover:text-sky-300"
								>
									<span className="min-w-0 flex-1 truncate text-[0.7rem] font-medium text-foreground">
										Q{item.questionIndex + 1} · {item.processView.agentLabel}
									</span>
									<Badge
										variant="secondary"
										className={cn(
											"shrink-0 text-[0.6rem]",
											explainQuestionsAgentBadgeClass(item.displayStatus),
										)}
									>
										{item.displayStatus}
									</Badge>
								</button>
								{canContinue && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 shrink-0 px-2 text-[0.65rem]"
										onClick={() => onContinue(item.question.id)}
									>
										<Play data-icon="inline-start" className="size-3" />
										Continuar
									</Button>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

export type { AgentRunState };

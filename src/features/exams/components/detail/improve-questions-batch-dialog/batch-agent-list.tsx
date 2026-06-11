import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { QuestionData } from "../exam-utils";
import {
	type ImproveQuestionsBatchAgentItem,
	improveQuestionsAgentBadgeClass,
} from "./types";

interface BatchAgentListProps {
	agentItems: ImproveQuestionsBatchAgentItem[];
	finishedCount: number;
	processingCount: number;
	errorCount: number;
	progressPercent: number;
	onAgentClick: (question: QuestionData) => void;
}

export function BatchAgentList({
	agentItems,
	finishedCount,
	processingCount,
	errorCount,
	progressPercent,
	onAgentClick,
}: BatchAgentListProps) {
	if (agentItems.length === 0) return null;

	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<div className="mb-2 flex items-center justify-between text-xs">
				<span className="font-semibold text-muted-foreground">
					Agentes em execução
				</span>
				<span className="text-muted-foreground">
					{finishedCount}/{agentItems.length} ({progressPercent}%)
				</span>
			</div>
			<Progress value={progressPercent} className="mb-2 h-2" />
			<div className="mb-2 text-xs text-muted-foreground">
				{processingCount > 0 && `${processingCount} processando`}
				{processingCount > 0 && errorCount > 0 && " • "}
				{errorCount > 0 && `${errorCount} com erro`}
			</div>
			<div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted p-2">
				<div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground/80">
					<Sparkles className="size-3.5 text-sky-500 dark:text-sky-300" />
					Agentes
				</div>
				<div className="grid gap-1.5">
					{agentItems.map((item) => (
						<button
							key={item.process.id}
							type="button"
							onClick={() => onAgentClick(item.question)}
							className="flex items-center gap-2 rounded-md border border-border bg-accent px-2.5 py-1.5 text-left transition-colors hover:border-sky-400/40 hover:bg-accent"
						>
							<span className="min-w-0 flex-1 truncate text-[0.7rem] font-medium text-foreground">
								Q{item.questionIndex + 1} ·{" "}
								{item.process.agentRunState?.label ?? "Improve question"}
							</span>
							<Badge
								variant="secondary"
								className={cn(
									"shrink-0 text-[0.6rem]",
									improveQuestionsAgentBadgeClass(item.displayStatus),
								)}
							>
								{item.displayStatus}
							</Badge>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

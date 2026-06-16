import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PipelineThread } from "@/features/ai/pipeline/ui";
import { cn } from "@/lib/utils";
import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "../types";
import { agentStateLabel, stageStatusLabel } from "./stage-labels";
import { useIngestChat } from "./use-ingest-chat";

interface IngestChatViewProps {
	agents: IngestAgentRunViewModel[];
	stages?: IngestPipelineStageViewModel[];
	selectedStageId: string | null;
}

export function IngestChatView({
	agents,
	stages = [],
	selectedStageId,
}: IngestChatViewProps) {
	const { scrollRef, groupedItems } = useIngestChat(
		agents,
		stages,
		selectedStageId,
	);

	return (
		<div
			ref={scrollRef}
			className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-muted p-3"
		>
			{groupedItems.length === 0 && (
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
					Waiting for agent output...
				</div>
			)}
			{groupedItems.map((item) => {
				if (item.type === "stage") {
					const statusInfo = stageStatusLabel(item.stageStatus ?? "pending");
					return (
						<div
							key={`stage-${item.stageId}`}
							className="flex items-center gap-2 py-1"
						>
							<Separator className="flex-1" />
							<Badge
								variant="secondary"
								className={cn(
									"shrink-0 text-[0.6rem] font-medium",
									statusInfo.className,
								)}
							>
								{item.stageLabel}
							</Badge>
							<Separator className="flex-1" />
						</div>
					);
				}

				if (!item.bubble) return null;
				const stateInfo = agentStateLabel(item.bubble.agentState);
				return (
					<PipelineThread
						key={item.bubble.id}
						layout="mini"
						mode="readonly"
						messages={[item.bubble.message]}
						isRunning={item.bubble.isStreaming}
						header={{
							title: item.bubble.agentName,
							status: stateInfo,
							isStreaming: item.bubble.isStreaming,
						}}
						collapsiblePrompts
					/>
				);
			})}
		</div>
	);
}

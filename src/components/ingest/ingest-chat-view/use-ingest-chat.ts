import { useEffect, useMemo, useRef } from "react";
import type {
	IngestAgentRunViewModel,
	IngestPipelineStageViewModel,
} from "../types";
import { buildChatBubbles, type ChatBubble } from "./chat-bubbles";

interface GroupedItem {
	type: "stage" | "bubble";
	stageId: string;
	stageLabel?: string;
	stageStatus?: IngestPipelineStageViewModel["status"];
	bubble?: ChatBubble;
}

export type { ChatBubble } from "./chat-bubbles";

export function useIngestChat(
	agents: IngestAgentRunViewModel[],
	stages: IngestPipelineStageViewModel[],
	selectedStageId: string | null,
) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const bubbles = useMemo(
		() => buildChatBubbles(agents, stages),
		[agents, stages],
	);

	const filteredBubbles = useMemo(
		() =>
			selectedStageId
				? bubbles.filter((b) => b.stageId === selectedStageId)
				: bubbles,
		[bubbles, selectedStageId],
	);

	const groupedItems = useMemo(() => {
		const items: GroupedItem[] = [];
		let lastStageId: string | null = null;

		for (const bubble of filteredBubbles) {
			if (bubble.stageId !== lastStageId) {
				const stage = stages.find((s) => s.stageId === bubble.stageId);
				items.push({
					type: "stage",
					stageId: bubble.stageId,
					stageLabel: stage?.label ?? bubble.stageId,
					stageStatus: stage?.status,
				});
				lastStageId = bubble.stageId;
			}
			items.push({ type: "bubble", stageId: bubble.stageId, bubble });
		}

		return items;
	}, [filteredBubbles, stages]);

	const prevCountRef = useRef(0);
	useEffect(() => {
		if (filteredBubbles.length > prevCountRef.current) {
			requestAnimationFrame(() => {
				scrollRef.current?.scrollTo({
					top: scrollRef.current.scrollHeight,
					behavior: "smooth",
				});
			});
		}
		prevCountRef.current = filteredBubbles.length;
	}, [filteredBubbles.length]);

	return { scrollRef, groupedItems };
}

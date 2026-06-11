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

function getBubbleContentSignature(bubble: ChatBubble) {
	let textLength = 0;
	let partCount = 0;
	let latestToolCallId = "";
	let latestToolResultToolCallId = "";

	for (const part of bubble.message.parts) {
		partCount += 1;

		if (part.type === "text") {
			textLength += part.text.length;
			continue;
		}

		if (part.type === "reasoning") {
			textLength += part.text.length;
			continue;
		}

		if (part.type === "dynamic-tool") {
			latestToolCallId = part.toolCallId;
			if (
				part.state === "output-available" ||
				part.state === "output-error" ||
				part.output != null
			) {
				latestToolResultToolCallId = part.toolCallId;
			}
		}
	}

	return [
		bubble.id,
		bubble.agentState,
		partCount,
		textLength,
		latestToolCallId,
		latestToolResultToolCallId,
	].join(":");
}

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

	const visibleContentSignature = useMemo(
		() => filteredBubbles.map(getBubbleContentSignature).join("|"),
		[filteredBubbles],
	);

	const prevSignatureRef = useRef("");
	useEffect(() => {
		if (
			filteredBubbles.length > 0 &&
			visibleContentSignature !== prevSignatureRef.current
		) {
			requestAnimationFrame(() => {
				scrollRef.current?.scrollTo({
					top: scrollRef.current.scrollHeight,
					behavior: "smooth",
				});
			});
		}
		prevSignatureRef.current = visibleContentSignature;
	}, [filteredBubbles.length, visibleContentSignature]);

	return { scrollRef, groupedItems };
}

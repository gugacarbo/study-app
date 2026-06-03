import { ShimmerTextSpan } from "@/components/shimmer-text-span";
import { DetailAccordion } from "../../detail-accordion/detail-accordion";

interface ChatMessageThinkingProps {
	content: string;
	isPending?: boolean;
}

export function ChatMessageThinking({
	content,
	isPending = false,
}: ChatMessageThinkingProps) {
	const trimmedContent = content.trim();
	if (!trimmedContent) return null;

	return (
		<DetailAccordion
			value="think"
			label="Raciocínio"
			tone="neutral"
			defaultOpen={isPending}
			className="border-0 px-0"
		>
			{isPending ? (
				<ShimmerTextSpan shimmerColor="blue-400">
					{trimmedContent}
				</ShimmerTextSpan>
			) : (
				<p className="whitespace-pre-wrap text-xs text-muted-foreground">
					{trimmedContent}
				</p>
			)}
		</DetailAccordion>
	);
}

import { ShimmerTextSpan } from "@/components/shimmer-text-span";

export function ChatMessageThinkingPlaceholder() {
	return (
		<ShimmerTextSpan
			shimmerColor="blue-400"
			className="text-sm leading-relaxed text-muted-foreground"
		>
			Thinking...
		</ShimmerTextSpan>
	);
}

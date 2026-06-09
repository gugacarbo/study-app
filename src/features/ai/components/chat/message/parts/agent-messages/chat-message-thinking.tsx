import { useEffect, useState } from "react";
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
	const [open, setOpen] = useState(isPending);

	useEffect(() => {
		setOpen(isPending);
	}, [isPending]);

	if (!trimmedContent) return null;

	return (
		<DetailAccordion
			value="think"
			label="Raciocínio"
			tone="neutral"
			open={open}
			onOpenChange={setOpen}
			className="border-0 px-0"
		>
			{isPending ? (
				<ShimmerTextSpan
					shimmerColor="blue-400"
					className="text-xs leading-relaxed text-muted-foreground"
				>
					{trimmedContent}
				</ShimmerTextSpan>
			) : (
				<p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
					{trimmedContent}
				</p>
			)}
		</DetailAccordion>
	);
}

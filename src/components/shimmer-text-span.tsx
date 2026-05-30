import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ShimmerTextSpanProps {
	children: ReactNode;
	className?: string;
	shimmerColor?: string;
	style?: CSSProperties;
}

export function ShimmerTextSpan({
	children,
	className,
	shimmerColor,
	style,
}: ShimmerTextSpanProps) {
	const resolvedShimmerColor = shimmerColor?.includes("-")
		? `var(--color-${shimmerColor})`
		: shimmerColor;

	const shimmerStyle = {
		...style,
		"--chat-thinking-shimmer": resolvedShimmerColor,
	} as CSSProperties;

	return (
		<span className={cn("chat-thinking-part", className)} style={shimmerStyle}>
			{children}
		</span>
	);
}

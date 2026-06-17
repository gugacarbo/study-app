import { BrainIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ThinkingIndicatorProps = {
	className?: string;
	label?: string;
};

export function ThinkingIndicator({
	className,
	label = "Pensando",
}: ThinkingIndicatorProps) {
	return (
		<div
			role="status"
			data-slot="aui_thinking-indicator"
			aria-label={label}
			className={cn(
				"flex items-center gap-2 text-xs font-medium text-foreground/80",
				className,
			)}
		>
			<BrainIcon
				data-slot="aui_thinking-indicator-icon"
				className="size-3.5 shrink-0 text-foreground/70"
			/>
			<span
				data-slot="aui_thinking-indicator-label"
				className="relative inline-block leading-none"
			>
				<span>{label}</span>
				<span
					aria-hidden
					data-slot="aui_thinking-indicator-shimmer"
					className="aui-thinking-indicator-shimmer shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
				>
					{label}
				</span>
			</span>
		</div>
	);
}

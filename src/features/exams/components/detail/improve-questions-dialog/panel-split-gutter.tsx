import { Columns2, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PanelLayout = "balanced" | "left" | "right";

interface PanelSplitGutterProps {
	layout: PanelLayout;
	onLayoutChange: (layout: PanelLayout) => void;
}

export function PanelSplitGutter({
	layout,
	onLayoutChange,
}: PanelSplitGutterProps) {
	const buttonClass = (active: boolean) =>
		cn(
			"transition-opacity duration-200 ease-out motion-reduce:transition-none",
			active ? "opacity-100" : "opacity-40 hover:opacity-70",
		);

	return (
		<div
			className={cn(
				"flex h-full w-full shrink-0 items-center justify-center gap-0.5 bg-muted/40",
				"flex-row border-y px-2 py-1.5 sm:flex-col sm:border-x sm:border-y-0 sm:px-1.5 sm:py-2",
				"transition-colors duration-200 ease-out motion-reduce:transition-none",
			)}
			role="toolbar"
			aria-label="Panel layout"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className={buttonClass(layout === "right")}
				onClick={() => onLayoutChange("right")}
				aria-label="Expand agent stream"
				aria-pressed={layout === "right"}
				title="Expand agent"
			>
				<PanelLeft className="size-4" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className={buttonClass(layout === "balanced")}
				onClick={() => onLayoutChange("balanced")}
				aria-label="Balanced layout"
				aria-pressed={layout === "balanced"}
				title="Balanced"
			>
				<Columns2 className="size-4" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className={buttonClass(layout === "left")}
				onClick={() => onLayoutChange("left")}
				aria-label="Expand question preview"
				aria-pressed={layout === "left"}
				title="Expand preview"
			>
				<PanelRight className="size-4" />
			</Button>
		</div>
	);
}

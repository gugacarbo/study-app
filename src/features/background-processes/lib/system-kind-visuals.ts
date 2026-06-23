import type { LucideIcon } from "lucide-react";
import {
	ArrowRightIcon,
	DatabaseIcon,
	FileTextIcon,
	InfoIcon,
	LoaderCircleIcon,
	RefreshCwIcon,
	SparklesIcon,
	ClipboardCheckIcon,
} from "lucide-react";

export type SystemKindVisual = {
	icon: LucideIcon;
	borderClass: string;
	bgClass: string;
	circleClass: string;
	textClass: string;
};

export const SYSTEM_KIND_VISUALS: Record<string, SystemKindVisual> = {
	phase: {
		icon: ArrowRightIcon,
		borderClass: "border-l-chart-3",
		bgClass: "bg-chart-3/10",
		circleClass: "bg-chart-3/15",
		textClass: "text-chart-3",
	},
	"file-read": {
		icon: FileTextIcon,
		borderClass: "border-l-chart-2",
		bgClass: "bg-chart-2/10",
		circleClass: "bg-chart-2/15",
		textClass: "text-chart-2",
	},
	"llm-call": {
		icon: SparklesIcon,
		borderClass: "border-l-chart-1",
		bgClass: "bg-chart-1/10",
		circleClass: "bg-chart-1/15",
		textClass: "text-chart-1",
	},
	"llm-retry": {
		icon: RefreshCwIcon,
		borderClass: "border-l-chart-5",
		bgClass: "bg-chart-5/10",
		circleClass: "bg-chart-5/15",
		textClass: "text-chart-5",
	},
	"persist-validating": {
		icon: ClipboardCheckIcon,
		borderClass: "border-l-chart-4",
		bgClass: "bg-chart-4/10",
		circleClass: "bg-chart-4/15",
		textClass: "text-chart-4",
	},
	"persist-progress": {
		icon: DatabaseIcon,
		borderClass: "border-l-chart-3",
		bgClass: "bg-chart-3/10",
		circleClass: "bg-chart-3/15",
		textClass: "text-chart-3",
	},
};

export const SYSTEM_KIND_FALLBACK: SystemKindVisual = {
	icon: InfoIcon,
	borderClass: "border-l-muted-foreground",
	bgClass: "bg-muted/50",
	circleClass: "bg-muted-foreground/15",
	textClass: "text-muted-foreground",
};

export const SYSTEM_KIND_ACTIVE_ICON = LoaderCircleIcon;

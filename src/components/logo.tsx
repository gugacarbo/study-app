import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

interface LogoProps extends SVGProps<SVGSVGElement> {
	variant?: "full" | "icon";
}

/** 4× coordinate system for crisp vector rendering at any display size. */
const DOTS = (
	<>
		<circle
			cx="88"
			cy="32"
			r="20"
			className="fill-blue-500 dark:fill-blue-400"
		/>
		<circle
			cx="40"
			cy="64"
			r="20"
			className="fill-blue-500 dark:fill-blue-400"
		/>
		<circle
			cx="40"
			cy="104"
			r="20"
			className="fill-green-500 dark:fill-green-400"
		/>
	</>
);

const ICON_VIEWBOX = "0 0 128 128";
/** Crops trailing whitespace so the wordmark sits closer to the dots. */
const FULL_ICON_VIEWBOX = "0 0 110 128";

const iconSvgProps = (viewBox: string) => ({
	viewBox,
	fill: "none" as const,
	xmlns: "http://www.w3.org/2000/svg",
	shapeRendering: "geometricPrecision" as const,
});

export function Logo({ variant = "icon", className, ...props }: LogoProps) {
	if (variant === "full") {
		return (
			<span
				className={cn("inline-flex items-center gap-1", className)}
				role="img"
				aria-label="Study"
			>
				<svg
					{...iconSvgProps(FULL_ICON_VIEWBOX)}
					aria-hidden
					className="h-8 w-auto shrink-0"
				>
					{DOTS}
				</svg>
				<span className="text-lg font-semibold tracking-tight text-foreground">
					Study
				</span>
			</span>
		);
	}

	return (
		<svg
			{...iconSvgProps(ICON_VIEWBOX)}
			aria-hidden
			className={cn("h-8 w-8", className)}
			{...props}
		>
			{DOTS}
		</svg>
	);
}

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

interface VirtualizedOutputTextProps {
	text: string;
}

/**
 * Virtualizes long streaming AI output text by splitting into lines
 * and only rendering the visible ones. Falls back to a simple div
 * for short content (≤200 lines).
 */
export function VirtualizedOutputText({ text }: VirtualizedOutputTextProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const lines = text.split("\n");
	const LINE_HEIGHT = 20; // matches text-[0.7rem] leading-relaxed (~20px)

	const virtualizer = useVirtualizer({
		count: lines.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => LINE_HEIGHT,
		overscan: 50,
	});

	if (lines.length <= 200) {
		return (
			<div className="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-[#0b1424] p-3 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap text-slate-200">
				{text}
			</div>
		);
	}

	return (
		<div
			ref={parentRef}
			className="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-[#0b1424] p-3 font-mono text-[0.7rem] leading-relaxed text-slate-200"
		>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualItem) => (
					<div
						key={virtualItem.key}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: `${virtualItem.size}px`,
							transform: `translateY(${virtualItem.start}px)`,
							whiteSpace: "pre-wrap",
							overflowWrap: "break-word",
						}}
					>
						{lines[virtualItem.index] || "\u00A0"}
					</div>
				))}
			</div>
		</div>
	);
}

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

interface VirtualizedLogLinesProps {
	logs: string[];
	className?: string;
}

export function VirtualizedLogLines({
	logs,
	className,
}: VirtualizedLogLinesProps) {
	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: logs.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 20, // ~0.7rem * 16px with leading = ~20px per line
		overscan: 20,
	});

	return (
		<div ref={parentRef} className={className}>
			{logs.length === 0 ? null : (
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
							data-index={virtualItem.index}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: `${virtualItem.size}px`,
								transform: `translateY(${virtualItem.start}px)`,
							}}
							className={
								logs[virtualItem.index].includes("Error") ||
								logs[virtualItem.index].includes("Warning")
									? "text-red-300"
									: ""
							}
						>
							{logs[virtualItem.index]}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

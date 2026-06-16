import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { PipelineLogEntry } from "@/features/ai/pipeline/types";
import { cn } from "@/lib/utils";

interface VirtualizedLogLinesProps {
	logs: PipelineLogEntry[];
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
		estimateSize: () => 24,
		overscan: 20,
	});

	if (logs.length <= 200) {
		return (
			<div ref={parentRef} className={className}>
				<div className="flex flex-col gap-1">
					{logs.map((log) => (
						<div
							key={log.id}
							className={cn(
								"flex items-start gap-2 whitespace-pre-wrap pr-4",
								logLevelClass(log.level),
							)}
						>
							<span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
								{log.level}
							</span>
							<div className="min-w-0 flex-1">
								<div>{log.message}</div>
								{log.agentRunId ? (
									<div className="text-[0.625rem] text-muted-foreground">
										Agent: {log.agentRunId}
									</div>
								) : null}
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

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
					{virtualizer.getVirtualItems().map((virtualItem) => {
						const log = logs[virtualItem.index];
						return (
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
								className={cn(
									"flex items-start gap-2 whitespace-pre-wrap pr-4",
									logLevelClass(log.level),
								)}
							>
								<span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
									{log.level}
								</span>
								<div className="min-w-0 flex-1">
									<div>{log.message}</div>
									{log.agentRunId ? (
										<div className="text-[0.625rem] text-muted-foreground">
											Agent: {log.agentRunId}
										</div>
									) : null}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function logLevelClass(level: PipelineLogEntry["level"]): string {
	switch (level) {
		case "error":
			return "text-red-600 dark:text-red-400";
		case "warning":
			return "text-amber-600 dark:text-amber-400";
		case "debug":
			return "text-muted-foreground";
		default:
			return "text-foreground/80";
	}
}

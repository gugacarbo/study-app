import { Loader2 } from "lucide-react";
import type { RefObject } from "react";

type UploadStatusProps = {
	stepText: string;
	streamText: string;
	totalTokens: number;
	streamEndRef: RefObject<HTMLDivElement | null>;
};

export function UploadStatus({
	stepText,
	streamText,
	totalTokens,
	streamEndRef,
}: UploadStatusProps) {
	return (
		<div className="mt-4 space-y-3">
			<div className="flex items-center gap-3">
				<Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
				<span className="text-sm text-muted-foreground">{stepText}</span>
			</div>

			{streamText && (
				<div className="max-h-32 overflow-y-auto rounded border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
					<code>{streamText}</code>
					<div ref={streamEndRef} />
				</div>
			)}

			<div className="flex justify-end">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
					{totalTokens > 0
						? `${totalTokens.toLocaleString()} tokens`
						: "0 tokens"}
				</span>
			</div>
		</div>
	);
}

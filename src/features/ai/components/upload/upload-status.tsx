import { Loader2 } from "lucide-react";
import type { RefObject } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type UploadStatusProps = {
	stepText: string;
	streamText: string;
	totalTokens: number;
	logs: string[];
	streamEndRef: RefObject<HTMLDivElement | null>;
};

export function UploadStatus({
	stepText,
	streamText,
	totalTokens,
	logs,
	streamEndRef,
}: UploadStatusProps) {
	return (
		<div className="mt-4 space-y-3">
			<div className="flex items-center gap-3">
				<Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
				<span className="text-sm text-muted-foreground">{stepText}</span>
			</div>

			<Tabs defaultValue="output" className="w-full">
				<TabsList>
					<TabsTrigger value="output">Output</TabsTrigger>
					<TabsTrigger value="logs">Logs</TabsTrigger>
				</TabsList>
				<TabsContent value="output">
					<div className="max-h-40 overflow-y-auto rounded border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
						<code>{streamText || "Waiting for AI output..."}</code>
						<div ref={streamEndRef} />
					</div>
				</TabsContent>
				<TabsContent value="logs">
					<div className="max-h-40 overflow-y-auto rounded border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
						{logs.length > 0 ? (
							logs.map((line) => <div key={line}>{line}</div>)
						) : (
							<div>No logs yet...</div>
						)}
					</div>
				</TabsContent>
			</Tabs>

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

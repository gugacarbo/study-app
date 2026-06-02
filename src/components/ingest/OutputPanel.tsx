import { Badge } from "@/components/ui/badge";
import type { TokenTotals } from "@/stores/ingestStore";
import { VirtualizedOutputText } from "./VirtualizedOutputText";

interface OutputPanelProps {
	text: string;
	tokenTotals: TokenTotals;
	isRunning: boolean;
}

export function OutputPanel({
	text,
	tokenTotals,
	isRunning,
}: OutputPanelProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="mb-2 flex items-center gap-2">
				<Badge variant="secondary" className="text-[0.625rem]">
					Tokens: {tokenTotals.total.toLocaleString()}
				</Badge>
			</div>
			{text ? (
				<VirtualizedOutputText text={text} />
			) : (
				<div className="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-[#0b1424] p-3 font-mono text-[0.7rem] leading-relaxed text-slate-500">
					{isRunning ? "Waiting for output..." : "No output yet"}
				</div>
			)}
		</div>
	);
}

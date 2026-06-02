import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IngestJob } from "@/stores/ingestStore";

interface QueueListProps {
	jobs: IngestJob[];
	focusedJobId: string | null;
	onFocusJob: (jobId: string) => void;
	onCancelJob: (jobId: string) => void;
}

export function QueueList({
	jobs,
	focusedJobId,
	onFocusJob,
	onCancelJob,
}: QueueListProps) {
	return (
		<Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-white/10 bg-[#1b2638] text-slate-100 shadow-sm">
			<CardHeader className="shrink-0">
				<CardTitle className="text-sm font-semibold">
					Queue ({jobs.length})
				</CardTitle>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 overflow-auto">
				{jobs.length === 0 ? (
					<p className="text-xs text-slate-400">No jobs yet</p>
				) : (
					<div className="flex flex-col gap-1.5">
						{[...jobs].reverse().map((job) => (
							<JobRow
								key={job.id}
								job={job}
								isFocused={job.id === focusedJobId}
								onFocus={() => onFocusJob(job.id)}
								onCancel={() => onCancelJob(job.id)}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function JobRow({
	job,
	isFocused,
	onFocus,
	onCancel,
}: {
	job: IngestJob;
	isFocused: boolean;
	onFocus: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="flex items-center justify-between rounded-md text-xs">
			<button
				type="button"
				onClick={onFocus}
				className={cn(
					"flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
					isFocused
						? "bg-blue-500/20 ring-1 ring-blue-400/30"
						: "hover:bg-slate-700/40",
				)}
			>
				<span className="truncate font-medium">{job.fileName}</span>
				<StatusBadge status={job.status} />
			</button>
			{(job.status === "queued" || job.status === "running") && (
				<Button
					variant="ghost"
					size="sm"
					className="ml-2 h-5 px-1.5 text-[0.625rem] text-slate-300 hover:bg-slate-700/50 hover:text-white"
					onClick={(e) => {
						e.stopPropagation();
						onCancel();
					}}
				>
					Cancel
				</Button>
			)}
		</div>
	);
}

function StatusBadge({ status }: { status: IngestJob["status"] }) {
	const variantMap: Record<
		IngestJob["status"],
		{
			variant: "default" | "secondary" | "destructive" | "outline";
			label: string;
		}
	> = {
		queued: { variant: "secondary", label: "Queued" },
		running: { variant: "default", label: "Running" },
		success: { variant: "outline", label: "Success" },
		error: { variant: "destructive", label: "Error" },
		canceled: { variant: "secondary", label: "Canceled" },
	};
	const { variant, label } = variantMap[status];

	return (
		<Badge variant={variant} className="shrink-0 text-[0.625rem]">
			{status === "running" && (
				<Loader2 className="mr-0.5 inline size-2 animate-spin" />
			)}
			{label}
		</Badge>
	);
}

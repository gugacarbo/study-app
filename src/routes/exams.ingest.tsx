import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { FlowStage, IngestJob } from "@/stores/ingestStore";
import {
	cancelJob,
	enqueueIngest,
	focusJob,
	ingestStore,
} from "@/stores/ingestStore";

export const Route = createFileRoute("/exams/ingest")({
	component: IngestPage,
});

function IngestPage() {
	const { jobs, focusedJobId } = useStore(ingestStore, (s) => ({
		jobs: s.jobs,
		focusedJobId: s.focusedJobId,
	}));

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const focusedJob =
		focusedJobId != null
			? (jobs.find((j) => j.id === focusedJobId) ?? null)
			: null;

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] ?? null;
		setSelectedFile(file);
	}

	async function handleUpload() {
		if (!selectedFile) return;
		const buffer = await selectedFile.arrayBuffer();
		enqueueIngest(selectedFile.name, Array.from(new Uint8Array(buffer)));
		setSelectedFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	return (
		<div className="container py-6">
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* Left: Upload + Queue */}
				<div className="flex flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle>Ingest Exams</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="w-full justify-start text-muted-foreground"
									onClick={() => fileInputRef.current?.click()}
								>
									<Upload className="mr-1 size-3.5" />
									{selectedFile
										? selectedFile.name
										: "Choose file (.pdf, .txt, .md)"}
								</Button>
							</div>
							<input
								ref={fileInputRef}
								type="file"
								accept=".pdf,.txt,.md"
								onChange={handleFileChange}
								className="hidden"
							/>
							<Button onClick={handleUpload} disabled={!selectedFile} size="sm">
								Upload &amp; Extract
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Queue ({jobs.length})</CardTitle>
						</CardHeader>
						<CardContent>
							{jobs.length === 0 ? (
								<p className="text-xs text-muted-foreground">No jobs yet</p>
							) : (
								<div className="flex flex-col gap-1.5">
									{[...jobs].reverse().map((job) => (
										<JobRow
											key={job.id}
											job={job}
											isFocused={job.id === focusedJobId}
										/>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Right: Focused Job Details */}
				<div className="flex flex-col gap-4">
					{!focusedJob ? (
						<Card>
							<CardContent className="py-8 text-center text-xs text-muted-foreground">
								Select a job from the queue
							</CardContent>
						</Card>
					) : (
						<FocusedJobDetail job={focusedJob} />
					)}
				</div>
			</div>
		</div>
	);
}

function JobRow({ job, isFocused }: { job: IngestJob; isFocused: boolean }) {
	return (
		<button
			type="button"
			onClick={() => focusJob(job.id)}
			className={cn(
				"flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
				isFocused
					? "bg-primary/10 ring-1 ring-primary/30"
					: "hover:bg-muted/50",
			)}
		>
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<span className="truncate font-medium">{job.fileName}</span>
				<StatusBadge status={job.status} />
			</div>
			{(job.status === "queued" || job.status === "running") && (
				<Button
					variant="ghost"
					size="sm"
					className="ml-2 h-5 px-1.5 text-[0.625rem] text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={(e) => {
						e.stopPropagation();
						cancelJob(job.id);
					}}
				>
					Cancel
				</Button>
			)}
		</button>
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
		<Badge variant={variant} className="shrink-0">
			{status === "running" && (
				<Loader2 className="mr-0.5 inline size-2 animate-spin" />
			)}
			{label}
		</Badge>
	);
}

function LogLines({ logs }: { logs: string[] }) {
	return logs.map((line) => (
		<div
			key={line}
			className={
				line.includes("Error") || line.includes("Warning")
					? "text-destructive"
					: ""
			}
		>
			{line}
		</div>
	));
}

function FocusedJobDetail({ job }: { job: IngestJob }) {
	return (
		<Card className="flex flex-1 flex-col">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<span className="truncate">{job.fileName}</span>
					<StatusBadge status={job.status} />
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				<Tabs defaultValue="output" className="flex flex-1 flex-col">
					<TabsList className="mb-3">
						<TabsTrigger value="output">Output</TabsTrigger>
						<TabsTrigger value="logs">Logs</TabsTrigger>
						<TabsTrigger value="flow">Flow</TabsTrigger>
					</TabsList>

					<TabsContent
						value="output"
						className="flex flex-1 flex-col data-[state=active]:flex data-[state=active]:flex-col"
					>
						<div className="mb-2 flex items-center gap-2">
							<Badge variant="secondary" className="text-[0.625rem]">
								Tokens: {job.tokenTotals.total.toLocaleString()}
							</Badge>
						</div>
						<div className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
							{job.streamText || (
								<span className="text-muted-foreground">
									{job.status === "running"
										? "Waiting for output..."
										: "No output yet"}
								</span>
							)}
						</div>
					</TabsContent>

					<TabsContent
						value="logs"
						className="flex flex-1 flex-col data-[state=active]:flex data-[state=active]:flex-col"
					>
						<div className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[0.7rem] leading-relaxed">
							{job.logs.length === 0 ? (
								<span className="text-muted-foreground">No logs yet</span>
							) : (
								<LogLines logs={job.logs} />
							)}
						</div>
					</TabsContent>

					<TabsContent
						value="flow"
						className="flex flex-1 flex-col data-[state=active]:flex data-[state=active]:flex-col"
					>
						<div className="flex-1 py-4">
							{job.flowStages.length === 0 ? (
								<p className="text-center text-xs text-muted-foreground">
									No flow stages yet
								</p>
							) : (
								<div className="flex flex-wrap items-center justify-center gap-1">
									{job.flowStages.map((stage, i) => (
										<FlowStageCard
											key={stage.stageId}
											stage={stage}
											showArrow={i < job.flowStages.length - 1}
										/>
									))}
								</div>
							)}
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function FlowStageCard({
	stage,
	showArrow,
}: {
	stage: FlowStage;
	showArrow: boolean;
}) {
	const statusColors: Record<FlowStage["status"], string> = {
		done: "border-green-500/50 bg-green-500/10",
		running: "border-blue-500/50 bg-blue-500/10",
		warning: "border-amber-500/50 bg-amber-500/10",
		error: "border-red-500/50 bg-red-500/10",
		pending: "border-muted-foreground/20 bg-muted/30",
	};

	const indicatorColors: Record<FlowStage["status"], string> = {
		done: "bg-green-500",
		running: "bg-blue-500",
		warning: "bg-amber-500",
		error: "bg-red-500",
		pending: "bg-muted-foreground/40",
	};

	return (
		<div className="flex items-center gap-0.5">
			<Card
				className={cn(
					"flex flex-col items-center gap-1 p-2 text-center",
					statusColors[stage.status],
				)}
				size="sm"
			>
				<div className="flex items-center gap-1">
					{stage.status === "running" ? (
						<Loader2 className="size-2.5 animate-spin text-blue-500" />
					) : (
						<div
							className={cn(
								"size-1.5 rounded-full",
								indicatorColors[stage.status],
							)}
						/>
					)}
					<span className="text-[0.625rem] font-medium whitespace-nowrap">
						{stage.label}
					</span>
				</div>
			</Card>
			{showArrow && (
				<span className="text-[0.625rem] text-muted-foreground">→</span>
			)}
		</div>
	);
}

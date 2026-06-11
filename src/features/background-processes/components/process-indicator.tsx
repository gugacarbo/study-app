import { Link } from "@tanstack/react-router";
import { Activity, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	type BackgroundProcess,
	type BackgroundProcessStatus,
	isCompletedProcess,
	isConnectionTestProcess,
	isExplanationGenerationProcess,
	isImproveQuestionsProcess,
	isIngestProcess,
} from "../store/types";
import { useBackgroundProcesses } from "../hooks/use-background-processes";

const KIND_CHIP_LABEL: Record<BackgroundProcess["kind"], string> = {
	ingest: "Upload",
	"improve-questions": "Improve",
	"explanation-generation": "Explanations",
	"connection-test": "Test",
};

const STATUS_LABEL: Record<BackgroundProcessStatus, string> = {
	running: "Running",
	queued: "Queued",
	success: "Done",
	error: "Error",
	canceled: "Canceled",
	awaiting_review: "Review",
};

const STATUS_COLOR: Record<BackgroundProcessStatus, string> = {
	running: "bg-blue-500 text-white dark:bg-blue-600 dark:text-blue-100",
	queued: "bg-amber-500 text-white dark:bg-amber-600 dark:text-amber-100",
	success: "bg-green-500 text-white dark:bg-green-600 dark:text-green-100",
	error: "bg-red-500 text-white dark:bg-red-600 dark:text-red-100",
	canceled: "bg-gray-400 text-white dark:bg-gray-600 dark:text-gray-200",
	awaiting_review:
		"bg-violet-500 text-white dark:bg-violet-600 dark:text-violet-100",
};

function getProcessLabel(process: BackgroundProcess): string {
	if (isIngestProcess(process)) {
		return process.fileName;
	}
	if (isImproveQuestionsProcess(process)) {
		return `Q${process.questionId} — Improve question`;
	}
	if (isExplanationGenerationProcess(process)) {
		return `Exam #${process.examId} — Explanations`;
	}
	if (isConnectionTestProcess(process)) {
		return `${process.modelDisplayName} — Connection test`;
	}
	return "Unknown process";
}

function getProcessTimestamp(process: BackgroundProcess): number {
	if (
		isIngestProcess(process) ||
		isExplanationGenerationProcess(process) ||
		isConnectionTestProcess(process)
	) {
		return process.createdAt;
	}
	if (isImproveQuestionsProcess(process) && "createdAt" in process) {
		const { createdAt } = process as { createdAt?: number };
		if (typeof createdAt === "number") return createdAt;
	}
	return Date.now();
}

function formatRelativeTime(timestamp: number): string {
	const diff = (Date.now() - timestamp) / 1000;
	if (diff < 60) return "< 1 min ago";
	if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function truncate(text: string, max = 22): string {
	return text.length > max ? `${text.slice(0, max)}...` : text;
}

function ProcessRow({
	process,
	onSelect,
}: {
	process: BackgroundProcess;
	onSelect: (id: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(process.id)}
			className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
		>
			<span className="min-w-0 flex-1 truncate text-foreground">
				{truncate(getProcessLabel(process))}
			</span>
			<span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[0.6rem] font-medium text-muted-foreground">
				{KIND_CHIP_LABEL[process.kind]}
			</span>
			<span
				className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium ${STATUS_COLOR[process.status]}`}
			>
				{STATUS_LABEL[process.status]}
			</span>
			<span className="shrink-0 text-xs text-muted-foreground">
				{formatRelativeTime(getProcessTimestamp(process))}
			</span>
		</button>
	);
}

function ProcessSection({
	title,
	processes,
	onSelect,
	emptyMessage,
}: {
	title: string;
	processes: BackgroundProcess[];
	onSelect: (id: string) => void;
	emptyMessage: string;
}) {
	return (
		<div>
			<div className="px-3 py-1.5 border-b border-border bg-muted/40">
				<span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
					{title}
				</span>
			</div>
			{processes.length === 0 ? (
				<div className="px-3 py-2 text-xs text-muted-foreground">
					{emptyMessage}
				</div>
			) : (
				processes.map((process) => (
					<ProcessRow key={process.id} process={process} onSelect={onSelect} />
				))
			)}
		</div>
	);
}

export function BackgroundProcessIndicator() {
	const { activeProcesses, recentProcesses, activeCount, focusProcess } =
		useBackgroundProcesses();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const recentCompleted = recentProcesses.filter(isCompletedProcess);

	useEffect(() => {
		if (!open) return;
		const handler = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	function handleItemClick(id: string) {
		focusProcess(id);
		setOpen(false);
	}

	const hasAnyProcesses = activeProcesses.length > 0 || recentCompleted.length > 0;
	const Icon = activeCount > 0 ? Loader2 : Activity;

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
				aria-label="Background processes"
			>
				<Icon
					className={`size-4 ${activeCount > 0 ? "animate-spin" : ""}`}
				/>
				<span className="hidden sm:inline">Processes</span>
				{activeCount > 0 && (
					<Badge
						variant="default"
						className="min-w-4 h-4 px-1 text-[0.6rem] animate-pulse"
					>
						{activeCount}
					</Badge>
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-1 w-80 rounded-md border border-border bg-popover shadow-lg z-50">
					<div className="flex items-center justify-between gap-2 p-2 border-b border-border">
						<span className="text-xs font-semibold text-foreground">
							Background Processes
						</span>
						<Button variant="ghost" size="sm" className="h-7 px-2" asChild>
							<Link
								to="/exams/upload"
								aria-label="Ver uploads"
								onClick={() => setOpen(false)}
							>
								<Upload className="size-3.5" />
							</Link>
						</Button>
					</div>
					{!hasAnyProcesses ? (
						<div className="p-4 text-center text-sm text-muted-foreground">
							No background processes yet
						</div>
					) : (
						<div className="max-h-96 overflow-y-auto">
							<ProcessSection
								title="Em execução"
								processes={activeProcesses}
								onSelect={handleItemClick}
								emptyMessage="Nenhum processo em execução"
							/>
							<ProcessSection
								title="Recentes"
								processes={recentCompleted}
								onSelect={handleItemClick}
								emptyMessage="Nenhum processo recente"
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

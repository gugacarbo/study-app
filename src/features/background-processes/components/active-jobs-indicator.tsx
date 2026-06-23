import { useNavigate } from "@tanstack/react-router";
import { ActivityIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveJobs } from "@/features/background-processes/hooks/use-active-jobs";
import type { ActiveJobSummary } from "@/functions/jobs/list-active-jobs";
import {
	INGEST_PHASE,
	type IngestPhase,
	JOB_STATUS,
	type JobStatus,
} from "@/lib/job-kinds";

const STATUS_LABELS: Record<JobStatus, string> = {
	[JOB_STATUS.AWAITING_UPLOAD]: "Aguardando upload",
	[JOB_STATUS.QUEUED]: "Na fila",
	[JOB_STATUS.RUNNING]: "Em execução",
	[JOB_STATUS.COMPLETED]: "Concluído",
	[JOB_STATUS.FAILED]: "Falhou",
	[JOB_STATUS.CANCELLED]: "Cancelado",
};

const PHASE_LABELS: Record<IngestPhase, string> = {
	[INGEST_PHASE.READING_FILE]: "Lendo arquivo",
	[INGEST_PHASE.EXTRACTING]: "Extraindo questões",
	[INGEST_PHASE.REVIEWING]: "Revisando questões",
	[INGEST_PHASE.PERSISTING]: "Salvando questões",
};

function formatJobLabel(job: ActiveJobSummary): string {
	return job.metadata.fileName ?? `Job ${job.id.slice(0, 8)}`;
}

function formatJobSubtitle(job: ActiveJobSummary): string {
	const statusLabel = STATUS_LABELS[job.status] ?? job.status;
	if (job.phase) {
		return `${statusLabel} · ${PHASE_LABELS[job.phase] ?? job.phase}`;
	}
	return statusLabel;
}

export function ActiveJobsIndicator() {
	const navigate = useNavigate();
	const { data } = useActiveJobs();
	const jobs = data?.jobs ?? [];

	if (jobs.length === 0) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="relative"
					aria-label={`${jobs.length} job(s) ativo(s)`}
				>
					<ActivityIcon className="size-4" />
					<Badge
						variant="default"
						className="absolute -top-1.5 -right-1.5 min-w-5 animate-pulse px-1.5"
					>
						{jobs.length}
					</Badge>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72">
				<DropdownMenuLabel>Jobs ativos</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{jobs.map((job) => (
					<DropdownMenuItem
						key={job.id}
						className="flex flex-col items-start gap-0.5"
						onSelect={() => {
							void navigate({
								to: "/jobs/$jobId",
								params: { jobId: job.id },
							});
						}}
					>
						<span className="font-medium">{formatJobLabel(job)}</span>
						<span className="text-xs text-muted-foreground">
							{formatJobSubtitle(job)}
						</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

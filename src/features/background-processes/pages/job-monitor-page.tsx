import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IngestAgentThread } from "@/features/background-processes/components/ingest-agent-thread";
import { IngestProgressPanel } from "@/features/background-processes/components/ingest-progress-panel";
import { JobWorkspaceLayout } from "@/features/background-processes/components/job-workspace-layout";
import { useJobMonitor } from "@/features/background-processes/hooks/use-job-monitor";
import { cancelJob } from "@/features/background-processes/lib/jobs-api";
import { isCancellableJobStatus, JOB_STATUS } from "@/lib/job-kinds";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type JobMonitorPageProps = {
	jobId: string;
};

export function JobMonitorPage({ jobId }: JobMonitorPageProps) {
	const navigate = useNavigate();
	const monitor = useJobMonitor(jobId);
	const [cancelError, setCancelError] = useState<string | null>(null);

	const cancelMutation = useMutation({
		mutationFn: () => cancelJob(jobId),
		onSuccess: () => {
			setCancelError(null);
			void monitor.refetch();
		},
		onError: (error) => {
			setCancelError(
				error instanceof Error ? error.message : "Não foi possível cancelar.",
			);
		},
	});

	async function handleCancel() {
		if (
			!window.confirm(
				"Cancelar esta importação? O processamento irá parar entre etapas.",
			)
		) {
			return;
		}
		cancelMutation.mutate();
	}

	useEffect(() => {
		if (monitor.isLoading) return;
		if (monitor.isAwaitingUpload) {
			void navigate({ to: "/exams/new" });
		}
	}, [monitor.isAwaitingUpload, monitor.isLoading, navigate]);

	if (monitor.isError) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Erro ao carregar job</AlertTitle>
				<AlertDescription>
					{monitor.errorMessage ?? "Não foi possível carregar o processamento."}
				</AlertDescription>
			</Alert>
		);
	}

	const isRunning =
		monitor.status === JOB_STATUS.QUEUED ||
		monitor.status === JOB_STATUS.RUNNING;
	const canCancel =
		monitor.status != null && isCancellableJobStatus(monitor.status);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">
					Acompanhe a extração de questões pelo agente em tempo real.
				</p>
				{canCancel ? (
					<Button
						variant="outline"
						size="sm"
						disabled={cancelMutation.isPending}
						onClick={() => void handleCancel()}
					>
						{cancelMutation.isPending ? "Cancelando…" : "Cancelar"}
					</Button>
				) : null}
			</div>

			{cancelError ? (
				<Alert variant="destructive">
					<AlertDescription>{cancelError}</AlertDescription>
				</Alert>
			) : null}

			<JobWorkspaceLayout
				chat={
					<IngestAgentThread
						messages={monitor.messages}
						isRunning={isRunning}
					/>
				}
				progress={
					<IngestProgressPanel
						status={monitor.status}
						phase={monitor.phase}
						error={monitor.error}
						metadata={monitor.metadata}
						progress={monitor.progress}
						isLoading={monitor.isLoading}
					/>
				}
			/>

			{monitor.isTerminal && monitor.status === JOB_STATUS.COMPLETED ? (
				<div className="flex flex-wrap gap-2">
					<Button asChild variant="outline">
						<Link to="/exams/new">Nova importação</Link>
					</Button>
					<Button asChild variant="secondary" disabled>
						Ver prova (em breve)
					</Button>
				</div>
			) : null}

			{monitor.isTerminal && monitor.status === JOB_STATUS.FAILED ? (
				<Button asChild variant="outline">
					<Link to="/exams/new">Tentar novamente</Link>
				</Button>
			) : null}

			{monitor.isTerminal && monitor.status === JOB_STATUS.CANCELLED ? (
				<Button asChild variant="outline">
					<Link to="/exams/new">Nova importação</Link>
				</Button>
			) : null}
		</div>
	);
}

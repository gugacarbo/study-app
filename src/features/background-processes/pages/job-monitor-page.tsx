import { useMutation } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ImproveQuestionsJobPanel } from "@/features/background-processes/components/improve-questions-job-panel";
import IngestEventsGroupedList from "@/features/background-processes/components/ingest-events-grouped-list";
import { IngestJobThread } from "@/features/background-processes/components/ingest-job-thread";
import { IngestProgressPanel } from "@/features/background-processes/components/ingest-progress-panel";
import { IngestUploadPanel } from "@/features/background-processes/components/ingest-upload-panel";
import { JobSidebarTabs } from "@/features/background-processes/components/job-sidebar-tabs";
import { JobWorkspaceLayout } from "@/features/background-processes/components/job-workspace-layout";
import { useJobMonitor } from "@/features/background-processes/hooks/use-job-monitor";
import { cancelJob } from "@/features/background-processes/lib/jobs-api";
import type { JobUploadLocationState } from "@/features/exams/hooks/use-ingest-job";
import {
	type IngestJobMetadata,
	isCancellableJobStatus,
	JOB_STATUS,
	parseImproveQuestionsJobMetadata,
} from "@/lib/job-kinds";

type JobMonitorPageProps = {
	jobId: string;
};

export function JobMonitorPage({ jobId }: JobMonitorPageProps) {
	const monitor = useJobMonitor(jobId);
	const pendingFile = useRouterState({
		select: (state) =>
			(state.location.state as JobUploadLocationState | undefined)?.pendingFile,
	});
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

	if (monitor.isAwaitingUpload) {
		return (
			<div
				data-fullwidth
				className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-5 md:px-6"
			>
				<p className="text-sm text-muted-foreground">
					Envie o arquivo da prova para iniciar a extração de questões.
				</p>
				<IngestUploadPanel
					jobId={jobId}
					pendingFile={pendingFile}
					onUploadComplete={() => {
						void monitor.refetchFromStart();
					}}
				/>
			</div>
		);
	}

	const isRunning =
		monitor.status === JOB_STATUS.QUEUED ||
		monitor.status === JOB_STATUS.RUNNING;
	const canCancel =
		monitor.status != null && isCancellableJobStatus(monitor.status);
	const improveMetadata = parseImproveQuestionsJobMetadata(
		monitor.metadata ? JSON.stringify(monitor.metadata) : null,
	);
	const isImproveJob = improveMetadata != null;

	return (
		<div
			data-fullwidth
			className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-5 md:px-6"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
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

			{isImproveJob ? (
				<ImproveQuestionsJobPanel
					status={monitor.status}
					phase={monitor.phase}
					error={monitor.error}
					metadata={improveMetadata}
					monitor={monitor.improve ?? { batchPhase: null, questions: [] }}
					events={monitor.events}
					isLoading={monitor.isLoading}
				/>
			) : (
				<JobWorkspaceLayout
					activity={
						<IngestJobThread
							messages={monitor.messages}
							isRunning={isRunning}
							status={monitor.status}
							phase={monitor.phase}
							metadata={
								(monitor.metadata ?? undefined) as IngestJobMetadata | undefined
							}
							progress={monitor.progress}
						/>
					}
					sidebar={
						<JobSidebarTabs
							eventsCount={monitor.events.length}
							progressContent={
								<IngestProgressPanel
									status={monitor.status}
									phase={monitor.phase}
									error={monitor.error}
									metadata={
										(monitor.metadata ?? null) as IngestJobMetadata | null
									}
									progress={monitor.progress}
									isLoading={monitor.isLoading}
								/>
							}
							eventsContent={
								<IngestEventsGroupedList
									events={monitor.events}
									isLoading={monitor.isLoading}
									status={monitor.status}
									phase={monitor.phase}
									error={monitor.error}
								/>
							}
						/>
					}
				/>
			)}

			{monitor.isTerminal && monitor.status === JOB_STATUS.FAILED ? (
				<div className="border-t pt-4">
					<Button asChild variant="outline">
						<Link to="/exams/new">Tentar novamente</Link>
					</Button>
				</div>
			) : null}

			{monitor.isTerminal && monitor.status === JOB_STATUS.CANCELLED ? (
				<div className="border-t pt-4">
					<Button asChild variant="outline">
						<Link to="/exams/new">Nova importação</Link>
					</Button>
				</div>
			) : null}
		</div>
	);
}

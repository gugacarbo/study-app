import { ImproveQuestionsActivityPanel } from "@/features/background-processes/components/improve-questions-activity-panel";
import { ImproveQuestionsEventsGroupedList } from "@/features/background-processes/components/improve-questions-events-grouped-list";
import { ImproveQuestionsProgressPanel } from "@/features/background-processes/components/improve-questions-progress-panel";
import { JobSidebarTabs } from "@/features/background-processes/components/job-sidebar-tabs";
import { JobWorkspaceLayout } from "@/features/background-processes/components/job-workspace-layout";
import type { ImproveMonitorState } from "@/features/background-processes/lib/improve-event-mapper";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ImproveQuestionsJobMetadata, JobStatus } from "@/lib/job-kinds";

type ImproveQuestionsJobPanelProps = {
	status: JobStatus | null;
	phase: string | null;
	error: string | null;
	metadata: ImproveQuestionsJobMetadata;
	monitor: ImproveMonitorState;
	events: JobEventRecord[];
	isLoading: boolean;
};

export function ImproveQuestionsJobPanel({
	status,
	phase: _phase,
	error,
	metadata,
	monitor,
	events,
	isLoading,
}: ImproveQuestionsJobPanelProps) {
	const activityContent = (
		<ImproveQuestionsActivityPanel monitor={monitor} status={status} />
	);
	const progressContent = (
		<ImproveQuestionsProgressPanel
			status={status}
			error={error}
			metadata={metadata}
			monitor={monitor}
			isLoading={isLoading}
		/>
	);
	const eventsContent = (
		<ImproveQuestionsEventsGroupedList
			monitor={monitor}
			events={events}
			status={status}
			isLoading={isLoading}
			error={error}
		/>
	);

	return (
		<>
			<div className="flex min-h-0 flex-1 flex-col md:hidden">
				<Tabs defaultValue="activity" className="flex h-full min-h-0 flex-col">
					<TabsList
						aria-label="Navegação mobile do job"
						className="mx-0 mb-4 w-fit"
					>
						<TabsTrigger value="activity">Atividade</TabsTrigger>
						<TabsTrigger value="progress">Progresso</TabsTrigger>
						<TabsTrigger value="events">Eventos ({events.length})</TabsTrigger>
					</TabsList>
					<TabsContent
						value="activity"
						className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card"
					>
						{activityContent}
					</TabsContent>
					<TabsContent
						value="progress"
						className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card"
					>
						{progressContent}
					</TabsContent>
					<TabsContent
						value="events"
						className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card"
					>
						{eventsContent}
					</TabsContent>
				</Tabs>
			</div>
			<div className="hidden min-h-0 flex-1 md:flex">
				<JobWorkspaceLayout
					className="w-full"
					activityLabel="Atividade do job"
					sidebarLabel="Progresso do job"
					activity={activityContent}
					sidebar={
						<JobSidebarTabs
							eventsCount={events.length}
							progressContent={progressContent}
							eventsContent={eventsContent}
						/>
					}
				/>
			</div>
		</>
	);
}

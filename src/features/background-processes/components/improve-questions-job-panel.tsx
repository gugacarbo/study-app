import { ImproveQuestionsActivityPanel } from "@/features/background-processes/components/improve-questions-activity-panel";
import { ImproveQuestionsEventsGroupedList } from "@/features/background-processes/components/improve-questions-events-grouped-list";
import { ImproveQuestionsProgressPanel } from "@/features/background-processes/components/improve-questions-progress-panel";
import { JobSidebarTabs } from "@/features/background-processes/components/job-sidebar-tabs";
import { JobWorkspaceLayout } from "@/features/background-processes/components/job-workspace-layout";
import type { ImproveMonitorState } from "@/features/background-processes/lib/improve-event-mapper";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
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
	return (
		<JobWorkspaceLayout
			activityLabel="Atividade do job"
			sidebarLabel="Progresso do job"
			activity={
				<ImproveQuestionsActivityPanel monitor={monitor} status={status} />
			}
			sidebar={
				<JobSidebarTabs
					eventsCount={events.length}
					progressContent={
						<ImproveQuestionsProgressPanel
							status={status}
							error={error}
							metadata={metadata}
							monitor={monitor}
							isLoading={isLoading}
						/>
					}
					eventsContent={
						<ImproveQuestionsEventsGroupedList
							monitor={monitor}
							events={events}
							status={status}
							isLoading={isLoading}
							error={error}
						/>
					}
				/>
			}
		/>
	);
}

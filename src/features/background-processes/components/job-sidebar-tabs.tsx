import IngestEventsGroupedList from "@/features/background-processes/components/ingest-events-grouped-list";
import { IngestProgressPanel } from "@/features/background-processes/components/ingest-progress-panel";
import type { IngestProgressState } from "@/features/background-processes/lib/ingest-event-mapper";
import type { JobEventRecord } from "@/features/background-processes/lib/jobs-api";
import type { IngestJobMetadata, JobStatus } from "@/lib/job-kinds";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type JobSidebarTabsProps = {
	status: JobStatus | null;
	phase: string | null;
	error: string | null;
	metadata: IngestJobMetadata | null;
	progress: IngestProgressState;
	events: JobEventRecord[];
	isLoading: boolean;
};

export function JobSidebarTabs({
	status,
	phase,
	error,
	metadata,
	progress,
	events,
	isLoading,
}: JobSidebarTabsProps) {
	return (
		<Tabs defaultValue="progress" className="flex h-full min-h-0 flex-col">
			<TabsList className="mx-4 mt-4 w-fit">
				<TabsTrigger value="progress">Progresso</TabsTrigger>
				<TabsTrigger value="events">Eventos ({events.length})</TabsTrigger>
			</TabsList>
			<TabsContent
				value="progress"
				className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
			>
				<IngestProgressPanel
					status={status}
					phase={phase}
					error={error}
					metadata={metadata}
					progress={progress}
					isLoading={isLoading}
				/>
			</TabsContent>
			<TabsContent
				value="events"
				className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
			>
				<IngestEventsGroupedList
					events={events}
					isLoading={isLoading}
					status={status}
					phase={phase}
					error={error}
				/>
			</TabsContent>
		</Tabs>
	);
}

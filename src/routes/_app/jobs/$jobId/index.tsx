import { createFileRoute } from "@tanstack/react-router";
import { JobMonitorPage } from "@/features/background-processes/pages/job-monitor-page";

export const Route = createFileRoute("/_app/jobs/$jobId/")({
	ssr: false,
	component: JobRoutePage,
});

function JobRoutePage() {
	const { jobId } = Route.useParams();
	return <JobMonitorPage jobId={jobId} />;
}

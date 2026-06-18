import { createFileRoute } from "@tanstack/react-router";
import { AdminJobsPage } from "@/features/admin/pages/admin-jobs-page";

export const Route = createFileRoute("/admin/jobs/")({
	component: AdminJobsPage,
});

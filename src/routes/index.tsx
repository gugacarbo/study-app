import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/features/dashboard/components/dashboard";

export const Route = createFileRoute("/")({
	component: DashboardPage,
});

function DashboardPage() {
	return <Dashboard />;
}

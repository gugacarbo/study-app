import { createFileRoute } from "@tanstack/react-router";
import { StatsTable } from "@/features/exams/components/stats/stats-table";

export const Route = createFileRoute("/exams/stats")({
	component: ExamsStatsPage,
});

function ExamsStatsPage() {
	return <StatsTable />;
}

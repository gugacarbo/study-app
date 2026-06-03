import { createFileRoute } from "@tanstack/react-router";
import { ExamsView } from "@/features/exams/components/list/exams-view";

export const Route = createFileRoute("/exams/")({
	component: ExamsIndexPage,
});

function ExamsIndexPage() {
	return <ExamsView />;
}

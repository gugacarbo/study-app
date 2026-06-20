import { createFileRoute } from "@tanstack/react-router";
import { ExamsPage } from "@/features/exams/pages/exams-page";

export const Route = createFileRoute("/_app/exams/")({
	component: ExamsPage,
});

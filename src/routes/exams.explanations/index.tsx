import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/exams/explanations/")({
	component: ExplanationsPage,
});

function ExplanationsPage() {
	return <Navigate to="/exams" />;
}

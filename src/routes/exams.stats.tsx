import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/exams/stats")({
	beforeLoad: () => {
		throw redirect({ to: "/exams" });
	},
	component: () => null,
});

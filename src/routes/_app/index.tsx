import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/features/admin/components/dashboard";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

function HomePage() {
	return <Dashboard />;
}

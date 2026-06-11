import { createFileRoute } from "@tanstack/react-router";
import { ConfigPage as AiConfigPage } from "@/features/config/components/config-page";

export const Route = createFileRoute("/admin/config")({
	component: AdminConfigRoutePage,
});

function AdminConfigRoutePage() {
	return (
		<div>
			<h1 className="text-2xl font-bold mb-4">AI Configuration</h1>
			<AiConfigPage />
		</div>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { ConfigForm } from "@/features/config/components/config-form";

export const Route = createFileRoute("/config")({
	component: ConfigPage,
});

function ConfigPage() {
	return (
		<div>
			<h1 className="text-2xl font-bold mb-6">Configuration</h1>
			<ConfigForm />
		</div>
	);
}

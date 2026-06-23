import { createFileRoute } from "@tanstack/react-router";
import { AdminModelsPage } from "@/features/admin/pages/admin-models-page";

export const Route = createFileRoute("/admin/models/")({
	component: AdminModelsPage,
});

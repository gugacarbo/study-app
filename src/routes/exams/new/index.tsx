import { createFileRoute } from "@tanstack/react-router";
import { IngestUploadForm } from "@/features/exams/components/ingest-upload-form";
import { requireSession } from "@/functions/auth/require-session";

export const Route = createFileRoute("/exams/new/")({
	beforeLoad: async () => {
		await requireSession();
	},
	component: ExamsNewPage,
});

function ExamsNewPage() {
	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<h1 className="text-xl font-semibold">Nova prova</h1>
				<p className="text-sm text-muted-foreground">
					Envie um arquivo .txt ou .md para extrair questões via IA.
				</p>
			</div>
			<IngestUploadForm />
		</div>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { IngestUploadForm } from "@/features/exams/components/ingest-upload-form";

export const Route = createFileRoute("/_app/exams/new/")({
	component: ExamsNewPage,
});

function ExamsNewPage() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<p className="text-sm text-muted-foreground">
					Envie um arquivo .txt ou .md para extrair questões via IA.
				</p>
			</div>
			<IngestUploadForm />
		</div>
	);
}

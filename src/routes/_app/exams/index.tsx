import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpenIcon, PlusCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/exams/")({
	component: ExamsPage,
});

function ExamsPage() {
	const navigate = useNavigate();

	return (
		<div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 text-center">
			<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<BookOpenIcon className="size-7" />
			</div>
			<div className="flex max-w-xs flex-col gap-2">
				<h2 className="text-lg font-semibold">Nenhuma prova ainda</h2>
				<p className="text-sm text-muted-foreground">
					Quando o catálogo estiver pronto, suas provas importadas vão
					aparecer aqui.
				</p>
			</div>
			<Button onClick={() => navigate({ to: "/exams/new" })}>
				<PlusCircleIcon data-icon="inline-start" />
				Importar prova
			</Button>
		</div>
	);
}

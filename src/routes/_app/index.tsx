import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpenIcon, PlusCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

function HomePage() {
	const navigate = useNavigate();

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold tracking-tight">
					Bora estudar?
				</h1>
				<p className="text-sm text-muted-foreground">
					Importe uma prova, revise as questões e treine no seu ritmo.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<Card className="border-primary/20 bg-primary/5">
					<CardContent className="flex flex-col gap-3 pt-6">
						<div className="flex items-start gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
								<PlusCircleIcon />
							</div>
							<div className="flex flex-col gap-1">
								<p className="font-medium">Importar prova</p>
								<p className="text-sm text-muted-foreground">
									Envie um .txt ou .md para extrair questões com IA.
								</p>
							</div>
						</div>
						<Button
							className="w-full"
							onClick={() => navigate({ to: "/exams/new" })}
						>
							Começar importação
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="flex items-center gap-3 pt-6">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<BookOpenIcon />
						</div>
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<p className="font-medium">Suas provas</p>
							<p className="text-sm text-muted-foreground">
								O catálogo chega em breve. Por enquanto, importe arquivos
								novos.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => navigate({ to: "/exams" })}
						>
							Ver
						</Button>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}

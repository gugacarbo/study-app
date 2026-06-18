import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<div className="space-y-4 rounded-lg border border-border bg-card p-6">
			<h1 className="text-xl font-semibold">Study App</h1>
			<p className="text-sm text-muted-foreground">
				Você está autenticado. O greenfield SPEC-0000–0002 está ativo.
			</p>
			<Link
				to="/exams/new"
				className="inline-flex text-sm font-medium text-primary underline"
			>
				Importar prova
			</Link>
			<button
				type="button"
				className="text-sm font-medium text-primary underline"
				onClick={async () => {
					await authClient.signOut();
					window.location.href = "/login";
				}}
			>
				Sair
			</button>
		</div>
	);
}

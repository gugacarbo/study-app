import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getSession } from "@/functions/auth/require-session";
import { authClient } from "@/lib/auth-client";
import { hasPermission } from "@/lib/rbac";

export const Route = createFileRoute("/")({
	loader: async () => {
		const session = await getSession();
		const isAdmin =
			session?.user?.id != null
				? await hasPermission(session.user.id, "admin:access")
				: false;
		return { isAdmin };
	},
	component: HomePage,
});

function HomePage() {
	const { isAdmin } = Route.useLoaderData();
	const navigate = useNavigate();

	return (
		<div className="space-y-4 rounded-lg border border-border bg-card p-6">
			<h1 className="text-xl font-semibold">Study App</h1>
			<p className="text-sm text-muted-foreground">
				Você está autenticado. O greenfield SPEC-0000–0002 está ativo.
			</p>
			<nav className="flex flex-col items-start gap-2">
				<Link
					to="/exams/new"
					className="inline-flex text-sm font-medium text-primary underline"
				>
					Importar prova
				</Link>
				{isAdmin ? (
					<Link
						to="/admin/config"
						className="inline-flex text-sm font-medium text-primary underline"
					>
						Configuração
					</Link>
				) : null}
			</nav>
			<button
				type="button"
				className="text-sm font-medium text-primary underline"
				onClick={async () => {
					await authClient.signOut();
					navigate({ to: "/login" });
				}}
			>
				Sair
			</button>
		</div>
	);
}

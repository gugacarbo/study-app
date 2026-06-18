import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession } from "@/functions/auth/require-session";
import { authClient } from "@/lib/auth-client";
import { isAllowedSignupEmail } from "@/lib/auth-allowed-email-domain";

const ALLOWED_DOMAINS = "ifsc.edu.br";

export const Route = createFileRoute("/login/")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session?.user) {
			throw redirect({ to: "/" });
		}
	},
	component: LoginPage,
});

export function LoginPage() {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<
		"idle" | "loading" | "sent" | "error"
	>("idle");
	const [message, setMessage] = useState<string | null>(null);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setStatus("loading");
		setMessage(null);

		if (!isAllowedSignupEmail(email, ALLOWED_DOMAINS)) {
			setStatus("error");
			setMessage("Este email não está autorizado. Use @ifsc.edu.br.");
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const callbackURL = params.get("redirect") || "/";

		const result = await authClient.signIn.magicLink({
			email,
			callbackURL,
		});

		if (result.error) {
			setStatus("error");
			setMessage(result.error.message ?? "Não foi possível enviar o link.");
			return;
		}

		setStatus("sent");
		setMessage("Se o email for válido, você receberá um link de acesso em breve.");
	}

	return (
		<div className="space-y-6 rounded-lg border border-border bg-card p-6">
			<div className="space-y-1">
				<h1 className="text-xl font-semibold">Entrar</h1>
				<p className="text-sm text-muted-foreground">
					Magic link apenas para emails <strong>@ifsc.edu.br</strong>.
				</p>
			</div>

			<form className="space-y-4" onSubmit={handleSubmit}>
				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						autoComplete="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder="voce@ifsc.edu.br"
						required
					/>
				</div>
				<Button type="submit" disabled={status === "loading"} className="w-full">
					{status === "loading" ? "Enviando…" : "Enviar link"}
				</Button>
			</form>

			{message ? (
				<p
					className={
						status === "error"
							? "text-sm text-destructive"
							: "text-sm text-muted-foreground"
					}
				>
					{message}
				</p>
			) : null}
		</div>
	);
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	formatAllowedDomainsHint,
	formatUnauthorizedEmailMessage,
	getPlaceholderEmail,
} from "@/env";
import { getSession } from "@/functions/auth/require-session";
import { authClient } from "@/lib/auth-client";
import { getAllowedSignupEmailDomains } from "@/lib/auth";
import { isAllowedSignupEmail } from "@/lib/auth-allowed-email-domain";

export const Route = createFileRoute("/login/")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session?.user) {
			throw redirect({ to: "/" });
		}
	},
	loader: async () => ({
		allowedSignupEmailDomains: await getAllowedSignupEmailDomains(),
	}),
	component: LoginPage,
});

type LoginPageContentProps = {
	allowedSignupEmailDomains: string;
};

export function LoginPageContent({
	allowedSignupEmailDomains,
}: LoginPageContentProps) {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<
		"idle" | "loading" | "sent" | "error"
	>("idle");
	const [message, setMessage] = useState<string | null>(null);
	const allowedDomainsHint = formatAllowedDomainsHint(allowedSignupEmailDomains);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setStatus("loading");
		setMessage(null);

		if (!isAllowedSignupEmail(email, allowedSignupEmailDomains)) {
			setStatus("error");
			setMessage(formatUnauthorizedEmailMessage(allowedSignupEmailDomains));
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
					Magic link apenas para emails{" "}
					<strong>{allowedDomainsHint || "autorizados"}</strong>.
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
						placeholder={getPlaceholderEmail(allowedSignupEmailDomains)}
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

function LoginPage() {
	const { allowedSignupEmailDomains } = Route.useLoaderData();
	return (
		<LoginPageContent allowedSignupEmailDomains={allowedSignupEmailDomains} />
	);
}

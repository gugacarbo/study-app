import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	formatAllowedDomainsHint,
	formatUnauthorizedEmailMessage,
	getPlaceholderEmail,
} from "@/env";
import { devLoginWithToken } from "@/functions/auth/dev-login-with-token";
import {
	getAllowedSignupEmailDomainsFn,
	getSession,
} from "@/functions/auth/require-session";
import { isAllowedSignupEmail } from "@/lib/auth-allowed-email-domain";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login/")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session?.user) {
			throw redirect({ to: "/" });
		}

		return {
			allowedSignupEmailDomains: await getAllowedSignupEmailDomainsFn(),
		};
	},
	component: LoginPage,
});

type LoginPageContentProps = {
	allowedSignupEmailDomains: string;
};

export function LoginPageContent({
	allowedSignupEmailDomains,
}: LoginPageContentProps) {
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
		"idle",
	);
	const [message, setMessage] = useState<string | null>(null);
	const [devToken, setDevToken] = useState("");
	const [devStatus, setDevStatus] = useState<"idle" | "loading">("idle");
	const router = useRouter();
	const allowedDomainsHint = formatAllowedDomainsHint(
		allowedSignupEmailDomains,
	);

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
		setMessage(
			"Se o email for válido, você receberá um link de acesso em breve.",
		);
	}

	async function handleDevTokenSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!import.meta.env.DEV) return;

		setDevStatus("loading");
		setMessage(null);

		try {
			await devLoginWithToken({ data: { token: devToken.trim() } });
			await router.navigate({ to: "/" });
		} catch {
			setStatus("error");
			setMessage("Não foi possível aplicar o token.");
		} finally {
			setDevStatus("idle");
		}
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
				<Button
					type="submit"
					disabled={status === "loading"}
					className="w-full"
				>
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

			{import.meta.env.DEV ? (
				<form
					className="space-y-3 border-t border-border pt-4"
					onSubmit={handleDevTokenSubmit}
				>
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Dev</p>
						<p className="text-xs text-muted-foreground">
							Cole o session token (D1) ou o valor do cookie{" "}
							<code className="text-[11px]">better-auth.session_token</code>.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="dev-token">Token</Label>
						<Input
							id="dev-token"
							value={devToken}
							onChange={(event) => setDevToken(event.target.value)}
							placeholder="session token ou cookie value"
							autoComplete="off"
						/>
					</div>
					<Button
						type="submit"
						variant="outline"
						disabled={devStatus === "loading" || !devToken.trim()}
						className="w-full"
					>
						{devStatus === "loading" ? "Aplicando…" : "Aplicar token"}
					</Button>
				</form>
			) : null}
		</div>
	);
}

function LoginPage() {
	const { allowedSignupEmailDomains } = Route.useRouteContext();
	return (
		<div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>
			<LoginPageContent allowedSignupEmailDomains={allowedSignupEmailDomains} />
		</div>
	);
}

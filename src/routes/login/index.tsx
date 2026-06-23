import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRef, useState } from "react";
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

const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === "development";

export const Route = createFileRoute("/login/")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session?.user) {
			throw redirect({ to: "/" });
		}
	},
	loader: async () => ({
		allowedSignupEmailDomains: await getAllowedSignupEmailDomainsFn(),
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
	const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
		"idle",
	);
	const [message, setMessage] = useState<string | null>(null);
	const [devStatus, setDevStatus] = useState<"idle" | "loading">("idle");
	const emailInputRef = useRef<HTMLInputElement | null>(null);
	const allowedDomainsHint = formatAllowedDomainsHint(
		allowedSignupEmailDomains,
	);
	const trimmedEmail = email.trim();

	function showUnauthorizedEmailMessage() {
		setStatus("error");
		setMessage(formatUnauthorizedEmailMessage(allowedSignupEmailDomains));
	}

	function getCurrentEmail() {
		return emailInputRef.current?.value.trim() ?? trimmedEmail;
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setStatus("loading");
		setMessage(null);

		const currentEmail = getCurrentEmail();
		if (!isAllowedSignupEmail(currentEmail, allowedSignupEmailDomains)) {
			showUnauthorizedEmailMessage();
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const callbackURL = params.get("redirect") || "/";

		const result = await authClient.signIn.magicLink({
			email: currentEmail,
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

	async function handleDevAutoLogin() {
		if (!isDev) return;

		setDevStatus("loading");
		setMessage(null);

		const currentEmail = getCurrentEmail();
		if (!isAllowedSignupEmail(currentEmail, allowedSignupEmailDomains)) {
			showUnauthorizedEmailMessage();
			setDevStatus("idle");
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const redirectTo = params.get("redirect") || "/";

		try {
			await devLoginWithToken({ data: { email: currentEmail } });
			window.location.assign(redirectTo);
		} catch {
			setStatus("error");
			setMessage("Não foi possível autenticar automaticamente.");
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
						ref={emailInputRef}
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

			{isDev ? (
				<div className="space-y-3 border-t border-border pt-4">
					<div className="space-y-1">
						<p className="text-xs font-medium text-muted-foreground">Dev</p>
						<p className="text-xs text-muted-foreground">
							Usa o email preenchido acima para criar ou reaproveitar uma sessão
							local automaticamente.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						disabled={devStatus === "loading"}
						className="w-full"
						onClick={handleDevAutoLogin}
					>
						{devStatus === "loading"
							? "Autenticando…"
							: "Entrar automaticamente"}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function LoginPage() {
	const { allowedSignupEmailDomains } = Route.useLoaderData();
	return (
		<div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>
			<LoginPageContent allowedSignupEmailDomains={allowedSignupEmailDomains} />
		</div>
	);
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
	getGoogleAuthEnabledFn,
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
		googleAuthEnabled: await getGoogleAuthEnabledFn(),
	}),
	component: LoginPage,
});

type LoginPageContentProps = {
	allowedSignupEmailDomains: string;
	googleAuthEnabled: boolean;
};

export function LoginPageContent({
	allowedSignupEmailDomains,
	googleAuthEnabled,
}: LoginPageContentProps) {
	const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] =
		useState(googleAuthEnabled);
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

	useEffect(() => {
		setIsGoogleAuthEnabled(googleAuthEnabled);
	}, [googleAuthEnabled]);

	useEffect(() => {
		if (googleAuthEnabled) return;

		let cancelled = false;

		void fetch("/api/auth/google-status")
			.then(async (response) => {
				if (!response.ok) return false;
				const payload = (await response.json()) as { enabled?: boolean };
				return payload.enabled === true;
			})
			.then((enabled) => {
				if (!cancelled && enabled) {
					setIsGoogleAuthEnabled(true);
				}
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [googleAuthEnabled]);

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

	async function handleGoogleSignIn() {
		setStatus("loading");
		setMessage(null);

		const params = new URLSearchParams(window.location.search);
		const callbackURL = params.get("redirect") || "/";

		const result = await authClient.signIn.social({
			provider: "google",
			callbackURL,
		});

		if (result.error) {
			setStatus("error");
			setMessage(result.error.message ?? "Não foi possível entrar com Google.");
			return;
		}
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
		<div className="space-y-4 rounded-lg border border-border bg-card p-6">
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

			{isGoogleAuthEnabled ? (
				<button
					type="button"
					disabled={status === "loading"}
					className="flex w-full h-9 items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] transition-colors hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-50"
					onClick={handleGoogleSignIn}
				>
					<svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
					</svg>
					Entrar com Google
				</button>
			) : null}

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
	const { allowedSignupEmailDomains, googleAuthEnabled } = Route.useLoaderData();
	return (
		<div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>
			<LoginPageContent
				allowedSignupEmailDomains={allowedSignupEmailDomains}
				googleAuthEnabled={googleAuthEnabled}
			/>
		</div>
	);
}

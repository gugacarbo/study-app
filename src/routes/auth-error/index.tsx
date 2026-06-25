import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ModeToggle } from "@/components/mode-toggle";

type ErrorSearchParams = {
	error?: string;
	error_description?: string;
};

type ErrorInfo = {
	title: string;
	description: string;
	action: string;
};

const ERROR_MAP: Record<string, ErrorInfo> = {
	account_not_linked: {
		title: "Conta não vinculada",
		description:
			"Esta conta de provedor externo (Google, etc.) não está vinculada ao seu usuário atual. O vínculo automático não foi possível porque o provedor não é confiável, o linking está desabilitado ou o email do provedor não confere com nenhum usuário existente.",
		action: "Tente entrar com o método que você usou originalmente para criar a conta (ex.: magic link).",
	},
	account_already_linked_to_different_user: {
		title: "Conta já vinculada a outro usuário",
		description:
			"Esta conta de provedor externo já está vinculada a um usuário diferente no sistema.",
		action: "Entre com a conta original ou use outro método de autenticação.",
	},
	unable_to_link_account: {
		title: "Não foi possível vincular a conta",
		description:
			"Ocorreu um erro ao tentar vincular esta conta de provedor externo ao seu usuário. O provedor pode não estar na lista de provedores confiáveis, ou houve uma falha no banco de dados.",
		action: "Tente novamente mais tarde ou entre em contato com o administrador.",
	},
	signup_disabled: {
		title: "Cadastro desabilitado",
		description:
			"Novos cadastros através deste provedor estão desabilitados no momento.",
		action: "Entre com um método de autenticação já existente ou contate o administrador.",
	},
	oauth_provider_not_found: {
		title: "Provedor OAuth não encontrado",
		description:
			"O provedor de autenticação solicitado não está configurado ou não existe.",
		action: "Verifique se o provedor está configurado corretamente ou contate o administrador.",
	},
	invalid_callback_request: {
		title: "Requisição de callback inválida",
		description:
			"A requisição de retorno do provedor de autenticação é inválida ou mal-formada.",
		action: "Tente fazer login novamente. Se o problema persistir, contate o administrador.",
	},
	invalid_code: {
		title: "Código de autenticação inválido",
		description:
			"O código de autorização recebido do provedor é inválido ou expirou.",
		action: "Tente fazer login novamente.",
	},
	state_not_found: {
		title: "Estado da sessão não encontrado",
		description:
			"Não foi possível encontrar os dados de sessão necessários para completar a autenticação. O estado pode ter expirado ou sido removido.",
		action: "Tente fazer login novamente do início.",
	},
	state_invalid: {
		title: "Estado da sessão inválido",
		description:
			"Os dados de estado da autenticação são inválidos ou foram corrompidos.",
		action: "Tente fazer login novamente.",
	},
	state_mismatch: {
		title: "Estado da sessão não corresponde",
		description:
			"O estado recebido não corresponde ao esperado. Isso pode indicar uma tentativa de ataque ou um problema de sessão.",
		action: "Tente fazer login novamente. Se o problema persistir, contate o administrador.",
	},
	no_code: {
		title: "Código de autorização ausente",
		description:
			"O provedor não retornou um código de autorização na resposta.",
		action: "Tente fazer login novamente.",
	},
	no_callback_url: {
		title: "URL de callback ausente",
		description:
			"A URL de callback necessária para completar a autenticação não foi fornecida.",
		action: "Tente fazer login novamente ou contate o administrador.",
	},
	email_not_found: {
		title: "Email não encontrado",
		description:
			"O provedor de autenticação não retornou um endereço de email para sua conta.",
		action: "Verifique se você concedeu as permissões necessárias ao provedor.",
	},
	email_doesn_t_match: {
		title: "Email não corresponde",
		description:
			"O email retornado pelo provedor não corresponde a nenhum usuário cadastrado.",
		action: "Use o email cadastrado no sistema ou entre com outro método de autenticação.",
	},
	unable_to_get_user_info: {
		title: "Não foi possível obter dados do usuário",
		description:
			"Ocorreu um erro ao obter as informações do usuário do provedor externo.",
		action: "Tente novamente mais tarde ou contate o administrador.",
	},
	unable_to_create_user: {
		title: "Não foi possível criar o usuário",
		description:
			"Ocorreu um erro ao criar sua conta no sistema. O email pode não estar autorizado ou houve uma falha interna.",
		action: "Verifique se seu email é permitido ou contate o administrador.",
	},
	unable_to_create_session: {
		title: "Não foi possível criar a sessão",
		description:
			"Ocorreu um erro ao criar sua sessão de autenticação.",
		action: "Tente novamente mais tarde. Se o problema persistir, contate o administrador.",
	},
	internal_server_error: {
		title: "Erro interno do servidor",
		description:
			"Ocorreu um erro inesperado no servidor de autenticação.",
		action: "Tente novamente mais tarde. Se o problema persistir, contate o administrador.",
	},
};

const UNKNOWN_ERROR: ErrorInfo = {
	title: "Erro de autenticação",
	description:
		"Ocorreu um erro inesperado durante o processo de autenticação.",
	action: "Tente fazer login novamente. Se o problema persistir, contate o administrador.",
};

function getErrorInfo(error?: string): ErrorInfo {
	if (error && error in ERROR_MAP) {
		return ERROR_MAP[error];
	}
	return UNKNOWN_ERROR;
}

export const Route = createFileRoute("/auth-error/")({
	validateSearch: (search: Record<string, string | undefined>): ErrorSearchParams => ({
		error: search.error,
		error_description: search.error_description,
	}),
	component: AuthErrorPage,
});

function AuthErrorPage() {
	const { error, error_description } = Route.useSearch();
	const errorInfo = useMemo(() => getErrorInfo(error), [error]);

	return (
		<div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
			<div className="absolute top-4 right-4">
				<ModeToggle />
			</div>
			<div className="space-y-6 rounded-lg border border-border bg-card p-6">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
							<svg
								className="size-5 text-destructive"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
								/>
							</svg>
						</div>
						<h1 className="text-xl font-semibold">{errorInfo.title}</h1>
					</div>
				</div>

				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						{errorInfo.description}
					</p>

					{error_description ? (
						<p className="text-xs text-muted-foreground/60 italic">
							Detalhe técnico: {error_description}
						</p>
					) : null}

					{error ? (
						<p className="text-xs text-muted-foreground/40 font-mono">
							Código: {error}
						</p>
					) : null}

					<div className="rounded-md bg-muted p-3">
						<p className="text-sm font-medium">O que fazer?</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{errorInfo.action}
						</p>
					</div>
				</div>

				<Link
					to="/login"
					className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Voltar para o login
				</Link>
			</div>
		</div>
	);
}

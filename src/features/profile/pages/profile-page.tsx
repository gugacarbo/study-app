import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, CheckCircle2Icon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getGoogleAuthEnabledFn } from "@/functions/auth/require-session";
import { authClient } from "@/lib/auth-client";

type LinkedAccount = {
	providerId: string;
};

function ProfilePageSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<Skeleton className="h-8 w-32" />
			<Skeleton className="h-56 w-full" />
		</div>
	);
}

export function ProfilePage() {
	const [message, setMessage] = useState<string | null>(null);
	const [isLinking, setIsLinking] = useState(false);

	const googleEnabledQuery = useQuery({
		queryKey: ["auth", "google-enabled"],
		queryFn: () => getGoogleAuthEnabledFn(),
	});

	const accountsQuery = useQuery({
		queryKey: ["auth", "linked-accounts"],
		queryFn: async () => {
			const result = await authClient.listAccounts();
			if (result.error) {
				throw new Error(
					result.error.message ?? "Não foi possível carregar contas vinculadas.",
				);
			}

			return (result.data ?? []) as LinkedAccount[];
		},
	});

	const isLoading = googleEnabledQuery.isPending || accountsQuery.isPending;
	const isGoogleEnabled = googleEnabledQuery.data === true;
	const isGoogleLinked =
		accountsQuery.data?.some((account) => account.providerId === "google") ?? false;
	const queryError =
		googleEnabledQuery.error?.message ?? accountsQuery.error?.message ?? null;

	async function handleGoogleLink() {
		setIsLinking(true);
		setMessage(null);

		const result = await authClient.linkSocial({
			provider: "google",
			callbackURL: "/profile",
		});

		if (result.error) {
			setMessage(
				result.error.message ?? "Não foi possível iniciar o vínculo com Google.",
			);
			setIsLinking(false);
		}
	}

	if (isLoading) {
		return <ProfilePageSkeleton />;
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<div className="space-y-2">
				<h2 className="text-2xl font-semibold tracking-tight">Perfil</h2>
				<p className="text-sm text-muted-foreground">
					Gerencie os provedores de login conectados na sua conta.
				</p>
			</div>

			<Card>
				<CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<CardTitle>Conta Google</CardTitle>
						<CardDescription>
							Vincule sua conta Google para poder entrar por esse provedor.
						</CardDescription>
					</div>
					<Badge variant={isGoogleLinked ? "default" : "outline"}>
						{isGoogleLinked ? "Conectada" : "Não conectada"}
					</Badge>
				</CardHeader>
				<CardContent className="space-y-4">
					{queryError ? (
						<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
							<div className="flex items-start gap-2">
								<AlertCircleIcon className="mt-0.5 size-4" />
								<p>{queryError}</p>
							</div>
						</div>
					) : null}

					{message ? (
						<div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
							<div className="flex items-start gap-2">
								<AlertCircleIcon className="mt-0.5 size-4" />
								<p>{message}</p>
							</div>
						</div>
					) : null}

					{isGoogleEnabled ? (
						isGoogleLinked ? (
							<div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex items-start gap-3">
									<CheckCircle2Icon className="mt-0.5 size-5 text-green-600" />
									<div className="space-y-1">
										<p className="font-medium">Conta Google conectada</p>
										<p className="text-sm text-muted-foreground">
											Seu login com Google já está vinculado a este usuário.
										</p>
									</div>
								</div>
								<Button disabled>Google vinculada</Button>
							</div>
						) : (
							<div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex items-start gap-3">
									<LinkIcon className="mt-0.5 size-5 text-muted-foreground" />
									<div className="space-y-1">
										<p className="font-medium">Nenhuma conta Google vinculada</p>
										<p className="text-sm text-muted-foreground">
											Conecte agora para habilitar o login com Google no seu
											perfil.
										</p>
									</div>
								</div>
								<Button onClick={handleGoogleLink} disabled={isLinking}>
									{isLinking ? "Conectando..." : "Vincular conta Google"}
								</Button>
							</div>
						)
					) : (
						<div className="rounded-lg border bg-muted/30 p-4">
								<div className="flex items-start gap-3">
									<AlertCircleIcon className="mt-0.5 size-5 text-muted-foreground" />
									<div className="space-y-1">
										<p className="font-medium">Login com Google indisponível</p>
										<p className="text-sm text-muted-foreground">
											O provedor Google ainda não está configurado neste ambiente.
										</p>
									</div>
								</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

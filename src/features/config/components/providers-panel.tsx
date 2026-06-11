import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	createProvider,
	deleteProvider,
	listProviders,
	updateProvider,
} from "@/server-functions/ai-providers";

type ProviderFormState = {
	id?: number;
	name: string;
	baseUrl: string;
	apiKey: string;
	enabled: boolean;
	hasApiKey: boolean;
};

const emptyForm = (): ProviderFormState => ({
	name: "",
	baseUrl: "https://openrouter.ai/api/v1",
	apiKey: "",
	enabled: true,
	hasApiKey: false,
});

export function ProvidersPanel() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [form, setForm] = useState<ProviderFormState>(emptyForm);
	const [message, setMessage] = useState("");

	const { data: providers = [] } = useQuery({
		queryKey: ["ai-providers"],
		queryFn: () => listProviders(),
	});

	const resetDialog = () => {
		setDialogOpen(false);
		setForm(emptyForm());
	};

	const openCreateDialog = () => {
		setForm(emptyForm());
		setMessage("");
		setDialogOpen(true);
	};

	const openEditDialog = (provider: (typeof providers)[number]) => {
		setForm({
			id: provider.id,
			name: provider.name,
			baseUrl: provider.baseUrl,
			apiKey: "",
			enabled: provider.enabled,
			hasApiKey: provider.hasApiKey,
		});
		setMessage("");
		setDialogOpen(true);
	};

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (form.id) {
				await updateProvider({
					data: {
						id: form.id,
						name: form.name,
						baseUrl: form.baseUrl,
						apiKey: form.apiKey.trim() || undefined,
						enabled: form.enabled,
					},
				});
				return;
			}
			if (!form.apiKey.trim()) {
				throw new Error("API key is required for new providers");
			}
			await createProvider({
				data: {
					name: form.name,
					baseUrl: form.baseUrl,
					apiKey: form.apiKey,
					enabled: form.enabled,
				},
			});
		},
		onSuccess: async () => {
			setMessage("Provider saved");
			resetDialog();
			await queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
		},
		onError: (error) => {
			setMessage(error instanceof Error ? error.message : "Failed to save");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteProvider({ data: { id } }),
		onSuccess: async () => {
			setMessage("Provider deleted");
			await queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
		},
		onError: (error) => {
			setMessage(error instanceof Error ? error.message : "Failed to delete");
		},
	});

	return (
		<>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between gap-3">
					<CardTitle>Providers</CardTitle>
					<Button type="button" size="sm" onClick={openCreateDialog}>
						<Plus className="size-3.5" />
						Add provider
					</Button>
				</CardHeader>
				<CardContent className="space-y-3">
					{message && !dialogOpen ? (
						<p className="text-xs text-muted-foreground">{message}</p>
					) : null}
					{providers.length === 0 ? (
						<p className="text-sm text-muted-foreground">No providers yet.</p>
					) : (
						providers.map((provider) => (
							<div
								key={provider.id}
								className="flex items-start justify-between gap-3 rounded-md border p-3"
							>
								<div>
									<p className="font-medium">{provider.name}</p>
									<p className="text-xs text-muted-foreground break-all">
										{provider.baseUrl}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										{provider.enabled ? "Enabled" : "Disabled"} ·{" "}
										{provider.hasApiKey ? "API key saved" : "No API key"}
									</p>
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => openEditDialog(provider)}
									>
										Edit
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={() => deleteMutation.mutate(provider.id)}
									>
										Delete
									</Button>
								</div>
							</div>
						))
					)}
				</CardContent>
			</Card>

			<Dialog
				open={dialogOpen}
				onOpenChange={(open) => {
					if (!open) resetDialog();
					else setDialogOpen(true);
				}}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b pb-4">
						<DialogTitle>
							{form.id ? "Edit provider" : "Add provider"}
						</DialogTitle>
						<div className="flex items-center gap-2 pr-8">
							<Label
								htmlFor="provider-enabled"
								className="text-muted-foreground font-normal"
							>
								Enabled
							</Label>
							<Switch
								id="provider-enabled"
								checked={form.enabled}
								onCheckedChange={(enabled) =>
									setForm((current) => ({ ...current, enabled }))
								}
							/>
						</div>
					</DialogHeader>

					<div className="space-y-3">
						<div className="space-y-1.5">
							<Label htmlFor="provider-name">Name</Label>
							<Input
								id="provider-name"
								value={form.name}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										name: event.target.value,
									}))
								}
								placeholder="OpenRouter"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="provider-base-url">Base URL</Label>
							<Input
								id="provider-base-url"
								value={form.baseUrl}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										baseUrl: event.target.value,
									}))
								}
								placeholder="https://openrouter.ai/api/v1"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="provider-api-key">API Key</Label>
							<Input
								id="provider-api-key"
								type="password"
								autoComplete="off"
								value={form.apiKey}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										apiKey: event.target.value,
									}))
								}
								placeholder={
									form.hasApiKey
										? "Saved — leave blank to keep current key"
										: "sk-..."
								}
							/>
						</div>
					</div>

					<DialogFooter className="border-t pt-4 sm:justify-between">
						{message ? (
							<p className="text-xs text-muted-foreground">{message}</p>
						) : (
							<span />
						)}
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={resetDialog}>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={() => saveMutation.mutate()}
								disabled={saveMutation.isPending}
							>
								{saveMutation.isPending ? "Saving..." : "Save provider"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

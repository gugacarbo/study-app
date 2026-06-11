import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	const [form, setForm] = useState<ProviderFormState>(emptyForm);
	const [message, setMessage] = useState("");

	const { data: providers = [] } = useQuery({
		queryKey: ["ai-providers"],
		queryFn: () => listProviders(),
	});

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
			setForm(emptyForm());
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
		<div className="grid gap-6 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Providers</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
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
										onClick={() =>
											setForm({
												id: provider.id,
												name: provider.name,
												baseUrl: provider.baseUrl,
												apiKey: "",
												enabled: provider.enabled,
												hasApiKey: provider.hasApiKey,
											})
										}
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

			<Card>
				<CardHeader>
					<CardTitle>{form.id ? "Edit provider" : "Add provider"}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="provider-name">Name</Label>
						<Input
							id="provider-name"
							value={form.name}
							onChange={(event) =>
								setForm((current) => ({ ...current, name: event.target.value }))
							}
							placeholder="OpenRouter"
						/>
					</div>
					<div className="space-y-2">
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
					<div className="space-y-2">
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
					<div className="flex items-center gap-2">
						<Switch
							id="provider-enabled"
							checked={form.enabled}
							onCheckedChange={(enabled) =>
								setForm((current) => ({ ...current, enabled }))
							}
						/>
						<Label htmlFor="provider-enabled">Enabled</Label>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							onClick={() => saveMutation.mutate()}
							disabled={saveMutation.isPending}
						>
							{saveMutation.isPending ? "Saving..." : "Save provider"}
						</Button>
						{form.id ? (
							<Button
								type="button"
								variant="outline"
								onClick={() => setForm(emptyForm())}
							>
								Cancel
							</Button>
						) : null}
					</div>
					{message ? (
						<p className="text-sm text-muted-foreground">{message}</p>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}

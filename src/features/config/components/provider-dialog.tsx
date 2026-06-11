import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { AiProviderPublic } from "@/db/queries/types";
import {
	createProvider,
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

function providerToForm(provider: AiProviderPublic): ProviderFormState {
	return {
		id: provider.id,
		name: provider.name,
		baseUrl: provider.baseUrl,
		apiKey: "",
		enabled: provider.enabled,
		hasApiKey: provider.hasApiKey,
	};
}

type ProviderDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	provider?: AiProviderPublic | null;
	onSaved?: () => void;
};

export function ProviderDialog({
	open,
	onOpenChange,
	provider = null,
	onSaved,
}: ProviderDialogProps) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<ProviderFormState>(emptyForm);
	const [message, setMessage] = useState("");

	useEffect(() => {
		if (!open) return;
		setForm(provider ? providerToForm(provider) : emptyForm());
		setMessage("");
	}, [open, provider]);

	const resetDialog = () => {
		onOpenChange(false);
		setForm(emptyForm());
		setMessage("");
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
			onSaved?.();
		},
		onError: (error) => {
			setMessage(error instanceof Error ? error.message : "Failed to save");
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) resetDialog();
				else onOpenChange(true);
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
	);
}

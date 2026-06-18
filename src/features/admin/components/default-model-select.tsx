import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AdminAiConfig } from "@/features/admin/hooks/use-admin-ai-config";

type DefaultModelSelectProps = {
	config: AdminAiConfig;
	value: string | null;
	disabled?: boolean;
	onChange: (modelId: string | null) => void;
};

export function DefaultModelSelect({
	config,
	value,
	disabled,
	onChange,
}: DefaultModelSelectProps) {
	const enabledProviders = new Set(
		config.providers.filter((p) => p.enabled).map((p) => p.id),
	);
	const options = config.models.filter(
		(model) => model.enabled && enabledProviders.has(model.providerId),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Modelo padrão</CardTitle>
				<CardDescription>
					Usado quando nenhum modelo é especificado nas chamadas de IA.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Select
					value={value ?? "none"}
					disabled={disabled || options.length === 0}
					onValueChange={(next) => onChange(next === "none" ? null : next)}
				>
					<SelectTrigger className="w-full max-w-md">
						<SelectValue placeholder="Selecione um modelo" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Nenhum</SelectItem>
						{options.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.displayName} ({model.modelId})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardContent>
		</Card>
	);
}

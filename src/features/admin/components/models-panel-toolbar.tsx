import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AdminAiConfig } from "@/features/admin/hooks/use-admin-ai-config";

type ModelsPanelToolbarProps = {
	providers: AdminAiConfig["providers"];
	providerId: string;
	providerEnabled: boolean;
	busy: boolean;
	onProviderChange: (providerId: string) => void;
	onDiscover: () => void;
	onCreate: () => void;
};

export function ModelsPanelToolbar({
	providers,
	providerId,
	providerEnabled,
	busy,
	onProviderChange,
	onDiscover,
	onCreate,
}: ModelsPanelToolbarProps) {
	return (
		<div className="flex flex-wrap gap-2">
			<Select value={providerId} onValueChange={onProviderChange}>
				<SelectTrigger className="w-[12rem]">
					<SelectValue placeholder="Provider" />
				</SelectTrigger>
				<SelectContent>
					{providers.map((provider) => (
						<SelectItem key={provider.id} value={provider.id}>
							{provider.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Button
				size="sm"
				variant="outline"
				disabled={!providerId || !providerEnabled || busy}
				onClick={onDiscover}
			>
				Importar
			</Button>
			<Button size="sm" disabled={!providerId} onClick={onCreate}>
				Novo modelo
			</Button>
		</div>
	);
}

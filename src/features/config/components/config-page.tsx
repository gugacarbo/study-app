import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DefaultsPanel } from "./defaults-panel";
import { ModelsPanel } from "./models-panel";
import { ProvidersPanel } from "./providers-panel";

export function ConfigPage() {
	return (
		<Tabs defaultValue="providers" className="w-full">
			<TabsList>
				<TabsTrigger value="providers">Providers</TabsTrigger>
				<TabsTrigger value="models">Models</TabsTrigger>
				<TabsTrigger value="defaults">Defaults & Test</TabsTrigger>
			</TabsList>
			<TabsContent value="providers" className="mt-6">
				<ProvidersPanel />
			</TabsContent>
			<TabsContent value="models" className="mt-6">
				<ModelsPanel />
			</TabsContent>
			<TabsContent value="defaults" className="mt-6">
				<DefaultsPanel />
			</TabsContent>
		</Tabs>
	);
}

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionTestDialogProvider } from "./connection-test-dialog-provider";
import { DefaultsPanel } from "./defaults-panel";
import { ModelsPanel } from "./models-panel";

export function ConfigPage() {
	const [activeTab, setActiveTab] = useState("models");

	return (
		<ConnectionTestDialogProvider
			onOpen={() => {
				setActiveTab((current) =>
					current === "defaults" ? current : "models",
				);
			}}
		>
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-0">
				<TabsList>
					<TabsTrigger value="models">Models</TabsTrigger>
					<TabsTrigger value="defaults">Defaults & Test</TabsTrigger>
				</TabsList>
				<TabsContent value="models" className="mt-4">
					<ModelsPanel />
				</TabsContent>
				<TabsContent value="defaults" className="mt-4">
					<DefaultsPanel />
				</TabsContent>
			</Tabs>
		</ConnectionTestDialogProvider>
	);
}

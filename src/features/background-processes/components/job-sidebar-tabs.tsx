import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type JobSidebarTabsProps = {
	progressContent: ReactNode;
	eventsContent: ReactNode;
	eventsCount: number;
};

export function JobSidebarTabs({
	progressContent,
	eventsContent,
	eventsCount,
}: JobSidebarTabsProps) {
	return (
		<Tabs defaultValue="progress" className="flex h-full min-h-0 flex-col">
			<TabsList className="mx-4 mt-4 w-fit">
				<TabsTrigger value="progress">Progresso</TabsTrigger>
				<TabsTrigger value="events">Eventos ({eventsCount})</TabsTrigger>
			</TabsList>
			<TabsContent
				value="progress"
				className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
			>
				{progressContent}
			</TabsContent>
			<TabsContent
				value="events"
				className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
			>
				{eventsContent}
			</TabsContent>
		</Tabs>
	);
}

import {
	type AssistantRuntime,
	AssistantRuntimeProvider,
} from "@assistant-ui/react";
import type { ReactNode } from "react";

interface StudyAssistantRuntimeProviderProps {
	runtime: AssistantRuntime;
	children: ReactNode;
}

export function StudyAssistantRuntimeProvider({
	runtime,
	children,
}: StudyAssistantRuntimeProviderProps) {
	return (
		<AssistantRuntimeProvider runtime={runtime}>
			{children}
		</AssistantRuntimeProvider>
	);
}

import {
	type AssistantRuntime,
	AssistantRuntimeProvider,
} from "@assistant-ui/react";
import { DevToolsModal } from "@assistant-ui/react-devtools";
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
			{import.meta.env.DEV ? <DevToolsModal /> : null}
			{children}
		</AssistantRuntimeProvider>
	);
}

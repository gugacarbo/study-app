import type { ToolJSONSchema } from "assistant-stream";

export interface ClientToolDefinition {
	name: string;
	description?: string;
	parameters: ToolJSONSchema["parameters"];
}

export interface PageChatContextRegistration {
	summary?: string;
	examId?: string;
	questionId?: string;
	clientTools?: ClientToolDefinition[];
}

type RegistryListener = () => void;

const registrations = new Map<string, PageChatContextRegistration>();
const listeners = new Set<RegistryListener>();

export function registerPageChatContext(
	contextKey: string,
	registration: PageChatContextRegistration,
): void {
	registrations.set(contextKey, registration);
	for (const listener of listeners) listener();
}

export function unregisterPageChatContext(contextKey: string): void {
	registrations.delete(contextKey);
	for (const listener of listeners) listener();
}

export function getPageChatRegistration(
	contextKey: string,
): PageChatContextRegistration | undefined {
	return registrations.get(contextKey);
}

export function subscribePageChatRegistry(listener: RegistryListener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

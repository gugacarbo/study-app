import type { UIMessage } from "@tanstack/ai-client";
import { Store } from "@tanstack/store";

export interface ChatState {
	messages: UIMessage[];
	isLoading: boolean;
	error: Error | undefined;
	input: string;
}

const initialState: ChatState = {
	messages: [],
	isLoading: false,
	error: undefined,
	input: "",
};

export const chatStore = new Store<ChatState>(initialState);

export function hydrateChat(state: ChatState) {
	chatStore.setState(() => state);
}

export function resetChat() {
	chatStore.setState(() => ({ ...initialState }));
}

export function setMessages(messages: UIMessage[]) {
	chatStore.setState((s) => ({ ...s, messages }));
}

export function setIsLoading(isLoading: boolean) {
	chatStore.setState((s) => ({ ...s, isLoading }));
}

export function setError(error: Error | undefined) {
	chatStore.setState((s) => ({ ...s, error }));
}

export function setInput(input: string) {
	chatStore.setState((s) => ({ ...s, input }));
}

export function appendMessage(message: UIMessage) {
	chatStore.setState((s) => ({ ...s, messages: [...s.messages, message] }));
}

export function clearChat() {
	chatStore.setState(() => ({ ...initialState }));
}

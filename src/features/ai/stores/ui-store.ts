import { Store } from "@tanstack/store";

export interface ChatUIState {
	chatSidebarOpen: boolean;
}

const STORAGE_KEY = "study-app:chat-ui";

const INITIAL_STATE: ChatUIState = {
	chatSidebarOpen: true,
};

function loadInitialState(): ChatUIState {
	if (typeof window === "undefined") return INITIAL_STATE;

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return INITIAL_STATE;

		const parsed = JSON.parse(raw) as Partial<ChatUIState>;
		return {
			chatSidebarOpen:
				typeof parsed.chatSidebarOpen === "boolean"
					? parsed.chatSidebarOpen
					: INITIAL_STATE.chatSidebarOpen,
		};
	} catch {
		return INITIAL_STATE;
	}
}

export const chatUIStore = new Store<ChatUIState>(loadInitialState());

let persistTimer: ReturnType<typeof setTimeout> | null = null;

chatUIStore.subscribe(() => {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		if (typeof window === "undefined") return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(chatUIStore.state));
		} catch {}
	}, 0);
});

export function setChatSidebarOpen(open: boolean): void {
	chatUIStore.setState((state) => ({ ...state, chatSidebarOpen: open }));
}

export function toggleChatSidebar(): void {
	chatUIStore.setState((state) => ({
		...state,
		chatSidebarOpen: !state.chatSidebarOpen,
	}));
}

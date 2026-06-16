import { Store } from "@tanstack/store";

export interface LayoutUIState {
	chatSidebarOpen: boolean;
	adminSidebarOpen: boolean;
	headerChatOpen: boolean;
	headerChatView: "popover" | "sheet";
	headerChatConversationsOpen: boolean;
	headerChatStreaming: boolean;
	headerChatError: boolean;
}

const STORAGE_KEY = "study-app:layout-ui";
const LEGACY_STORAGE_KEY = "study-app:chat-ui";
const LAYOUT_UI_WINDOW_KEY = "__STUDY_APP_LAYOUT_UI__";
const LAYOUT_UI_STORE_KEY = "__STUDY_APP_LAYOUT_UI_STORE__";
const LAYOUT_UI_HYDRATED_KEY = "__STUDY_APP_LAYOUT_UI_HYDRATED__";

const INITIAL_STATE: LayoutUIState = {
	chatSidebarOpen: true,
	adminSidebarOpen: true,
	headerChatOpen: false,
	headerChatView: "popover",
	headerChatConversationsOpen: false,
	headerChatStreaming: false,
	headerChatError: false,
};

function parseSidebarOpen(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function readPersistedLayoutUIState(): Partial<LayoutUIState> | null {
	if (typeof window === "undefined") return null;

	const primed = (window as unknown as Record<string, unknown>)[
		LAYOUT_UI_WINDOW_KEY
	];
	if (primed && typeof primed === "object") {
		return primed as Partial<LayoutUIState>;
	}

	try {
		const raw =
			localStorage.getItem(STORAGE_KEY) ??
			localStorage.getItem(LEGACY_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as Partial<LayoutUIState>;
	} catch {
		return null;
	}
}

function loadInitialState(): LayoutUIState {
	const parsed = readPersistedLayoutUIState();
	if (!parsed) return INITIAL_STATE;

	return {
		chatSidebarOpen: parseSidebarOpen(
			parsed.chatSidebarOpen,
			INITIAL_STATE.chatSidebarOpen,
		),
		adminSidebarOpen: parseSidebarOpen(
			parsed.adminSidebarOpen,
			INITIAL_STATE.adminSidebarOpen,
		),
		headerChatOpen:
			typeof parsed.headerChatOpen === "boolean"
				? parsed.headerChatOpen
				: INITIAL_STATE.headerChatOpen,
		headerChatView:
			parsed.headerChatView === "sheet" ? "sheet" : INITIAL_STATE.headerChatView,
		headerChatConversationsOpen: parseSidebarOpen(
			parsed.headerChatConversationsOpen,
			INITIAL_STATE.headerChatConversationsOpen,
		),
		headerChatStreaming: INITIAL_STATE.headerChatStreaming,
		headerChatError: INITIAL_STATE.headerChatError,
	};
}

/** Inline script: prime layout UI state before the client bundle runs. */
export function getLayoutUIScript(): string {
	const key = JSON.stringify(STORAGE_KEY);
	const legacyKey = JSON.stringify(LEGACY_STORAGE_KEY);
	const winKey = JSON.stringify(LAYOUT_UI_WINDOW_KEY);
	return `(function(){try{var r=localStorage.getItem(${key})||localStorage.getItem(${legacyKey});if(r)window[${winKey}]=JSON.parse(r)}catch(e){}})();`;
}

type LayoutUIGlobal = typeof globalThis & {
	[LAYOUT_UI_STORE_KEY]?: Store<LayoutUIState>;
	[LAYOUT_UI_HYDRATED_KEY]?: boolean;
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function createLayoutUIStore(): Store<LayoutUIState> {
	const store = new Store<LayoutUIState>(loadInitialState());

	store.subscribe(() => {
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			if (typeof window === "undefined") return;
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state));
				localStorage.removeItem(LEGACY_STORAGE_KEY);
			} catch {}
		}, 0);
	});

	return store;
}

export function getLayoutUIStore(): Store<LayoutUIState> {
	const globalStore = globalThis as LayoutUIGlobal;
	if (!globalStore[LAYOUT_UI_STORE_KEY]) {
		globalStore[LAYOUT_UI_STORE_KEY] = createLayoutUIStore();
	}
	return globalStore[LAYOUT_UI_STORE_KEY];
}

/** Re-read layout UI state from localStorage on the client (after SSR). */
export function hydrateLayoutUIStore(): void {
	const globalStore = globalThis as LayoutUIGlobal;
	if (typeof window === "undefined" || globalStore[LAYOUT_UI_HYDRATED_KEY]) {
		return;
	}

	globalStore[LAYOUT_UI_HYDRATED_KEY] = true;
	getLayoutUIStore().setState(() => loadInitialState());
}

export function setChatSidebarOpen(open: boolean): void {
	getLayoutUIStore().setState((state) => ({ ...state, chatSidebarOpen: open }));
}

export function setAdminSidebarOpen(open: boolean): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		adminSidebarOpen: open,
	}));
}

export function setHeaderChatOpen(open: boolean): void {
	getLayoutUIStore().setState((state) => ({ ...state, headerChatOpen: open }));
}

export function toggleHeaderChatOpen(): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		headerChatOpen: !state.headerChatOpen,
	}));
}

export function setHeaderChatView(view: "popover" | "sheet"): void {
	getLayoutUIStore().setState((state) => ({ ...state, headerChatView: view }));
}

export function setHeaderChatConversationsOpen(open: boolean): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		headerChatConversationsOpen: open,
	}));
}

export function toggleHeaderChatConversationsOpen(): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		headerChatConversationsOpen: !state.headerChatConversationsOpen,
	}));
}

export function setHeaderChatStreaming(streaming: boolean): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		headerChatStreaming: streaming,
	}));
}

export function setHeaderChatError(hasError: boolean): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		headerChatError: hasError,
	}));
}

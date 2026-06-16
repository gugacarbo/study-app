import { Store } from "@tanstack/store";

export interface LayoutUIState {
	chatSidebarOpen: boolean;
	adminSidebarOpen: boolean;
}

const STORAGE_KEY = "study-app:layout-ui";
const LEGACY_STORAGE_KEY = "study-app:chat-ui";
const LAYOUT_UI_WINDOW_KEY = "__STUDY_APP_LAYOUT_UI__";
const LAYOUT_UI_STORE_KEY = "__STUDY_APP_LAYOUT_UI_STORE__";
const LAYOUT_UI_HYDRATED_KEY = "__STUDY_APP_LAYOUT_UI_HYDRATED__";

const INITIAL_STATE: LayoutUIState = {
	chatSidebarOpen: true,
	adminSidebarOpen: true,
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

/** Proxy so duplicate module instances always resolve the same global store. */
export const layoutUIStore: Store<LayoutUIState> = new Proxy(
	{} as Store<LayoutUIState>,
	{
		get(_target, prop) {
			const store = getLayoutUIStore();
			const value = store[prop as keyof Store<LayoutUIState>];
			return typeof value === "function"
				? (value as (...args: never[]) => unknown).bind(store)
				: value;
		},
	},
);

/** @deprecated Use `layoutUIStore` */
export const chatUIStore = layoutUIStore;

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
	getLayoutUIStore().setState((state) => ({ ...state, adminSidebarOpen: open }));
}

export function toggleChatSidebar(): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		chatSidebarOpen: !state.chatSidebarOpen,
	}));
}

export function toggleAdminSidebar(): void {
	getLayoutUIStore().setState((state) => ({
		...state,
		adminSidebarOpen: !state.adminSidebarOpen,
	}));
}

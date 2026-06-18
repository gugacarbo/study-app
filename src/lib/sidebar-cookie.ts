export const SIDEBAR_COOKIE_NAME = "study-app-sidebar";

/** One year in seconds (365 days). */
export const SIDEBAR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export type SidebarCookieState = "expanded" | "collapsed";

const VALID_STATES = new Set<SidebarCookieState>(["expanded", "collapsed"]);

function parseSidebarCookieValue(value: string): SidebarCookieState | null {
	if (VALID_STATES.has(value as SidebarCookieState)) {
		return value as SidebarCookieState;
	}
	return null;
}

export function readSidebarCookie(): SidebarCookieState {
	if (typeof document === "undefined") {
		return "expanded";
	}

	const prefix = `${SIDEBAR_COOKIE_NAME}=`;
	for (const entry of document.cookie.split(";")) {
		const trimmed = entry.trim();
		if (trimmed.startsWith(prefix)) {
			const value = trimmed.slice(prefix.length);
			return parseSidebarCookieValue(value) ?? "expanded";
		}
	}

	return "expanded";
}

export function writeSidebarCookie(state: SidebarCookieState): void {
	document.cookie = `${SIDEBAR_COOKIE_NAME}=${state}; path=/; SameSite=Lax; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

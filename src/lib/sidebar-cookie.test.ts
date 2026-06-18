import { afterEach, describe, expect, it, vi } from "vitest";
import {
	SIDEBAR_COOKIE_MAX_AGE,
	SIDEBAR_COOKIE_NAME,
	readSidebarCookie,
	writeSidebarCookie,
} from "@/lib/sidebar-cookie";

function clearSidebarCookie() {
	document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
}

describe("sidebar-cookie", () => {
	afterEach(() => {
		clearSidebarCookie();
	});

	it("returns expanded when cookie is missing", () => {
		clearSidebarCookie();
		expect(readSidebarCookie()).toBe("expanded");
	});

	it("returns expanded when cookie value is invalid", () => {
		document.cookie = `${SIDEBAR_COOKIE_NAME}=unknown; path=/`;
		expect(readSidebarCookie()).toBe("expanded");
	});

	it("returns expanded in SSR when document is unavailable", () => {
		const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
		Object.defineProperty(globalThis, "document", {
			value: undefined,
			configurable: true,
		});

		expect(readSidebarCookie()).toBe("expanded");

		if (documentDescriptor) {
			Object.defineProperty(globalThis, "document", documentDescriptor);
		}
	});

	it("reads expanded and collapsed from cookie", () => {
		document.cookie = `${SIDEBAR_COOKIE_NAME}=expanded; path=/`;
		expect(readSidebarCookie()).toBe("expanded");

		document.cookie = `${SIDEBAR_COOKIE_NAME}=collapsed; path=/`;
		expect(readSidebarCookie()).toBe("collapsed");
	});

	it("writes and reads expanded round-trip", () => {
		writeSidebarCookie("expanded");
		expect(readSidebarCookie()).toBe("expanded");
	});

	it("writes and reads collapsed round-trip", () => {
		writeSidebarCookie("collapsed");
		expect(readSidebarCookie()).toBe("collapsed");
	});

	it("sets path, SameSite, and max-age on write", () => {
		const setCookie = vi.fn();
		const cookieDescriptor = Object.getOwnPropertyDescriptor(document, "cookie");

		Object.defineProperty(document, "cookie", {
			configurable: true,
			get: cookieDescriptor?.get,
			set: setCookie,
		});

		writeSidebarCookie("collapsed");

		expect(setCookie).toHaveBeenCalledOnce();
		const cookieString = setCookie.mock.calls[0]?.[0] as string;
		expect(cookieString).toContain(`${SIDEBAR_COOKIE_NAME}=collapsed`);
		expect(cookieString).toContain("path=/");
		expect(cookieString).toContain("SameSite=Lax");
		expect(cookieString).toContain(`max-age=${SIDEBAR_COOKIE_MAX_AGE}`);

		if (cookieDescriptor) {
			Object.defineProperty(document, "cookie", cookieDescriptor);
		}
	});
});

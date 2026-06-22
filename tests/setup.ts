import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
	Element.prototype.scrollTo = () => {};
}

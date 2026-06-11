class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
	globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
}

if (typeof HTMLElement.prototype.scrollTo !== "function") {
	HTMLElement.prototype.scrollTo = () => {};
}

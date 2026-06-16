import { DevToolsModal } from "@assistant-ui/react-devtools";
import { createPortal } from "react-dom";

/**
 * Renders assistant-ui DevTools at document.body so the modal is not clipped by
 * Radix popovers/sheets (transform + overflow) or other nested stacking contexts.
 */
export function AssistantDevToolsPortal() {
	if (!import.meta.env.DEV) return null;
	if (typeof document === "undefined") return null;
	return createPortal(<DevToolsModal />, document.body);
}

import { DevToolsModal } from "@assistant-ui/react-devtools";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders assistant-ui DevTools at document.body so the modal is not clipped by
 * Radix popovers/sheets (transform + overflow) or other nested stacking contexts.
 */
export function AssistantDevToolsPortal() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!import.meta.env.DEV || !mounted) return null;
	return createPortal(<DevToolsModal />, document.body);
}

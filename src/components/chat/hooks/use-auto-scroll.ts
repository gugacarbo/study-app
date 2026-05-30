import { type RefObject, useEffect } from "react";

export function useAutoScroll(
	bottomRef: RefObject<HTMLDivElement | null>,
	trigger = 0,
) {
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	useEffect(() => {
		if (trigger <= 0) return;
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [bottomRef, trigger]);
}

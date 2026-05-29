import { type RefObject, useEffect } from "react";

export function useAutoScroll(bottomRef: RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	});
}

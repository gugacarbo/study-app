import { describe, expect, it } from "vitest";
import {
	getConversationsGrouped,
	getConversationsForContext,
} from "@/features/ai/stores/conversations-store/selectors";
import type { Conversation } from "@/features/ai/stores/conversations-store/types";

function conv(
	id: string,
	contextKey: string | null,
	updatedAt: number,
): Conversation {
	return {
		id,
		title: id,
		contextKey,
		messageCount: 0,
		createdAt: updatedAt,
		updatedAt,
	};
}

describe("conversation grouping selectors", () => {
	const conversations = [
		conv("a", "exam:1", 300),
		conv("b", "exam:2", 200),
		conv("c", "exam:1", 100),
		conv("d", null, 50),
	];

	it("groups conversations for the current page context", () => {
		const grouped = getConversationsGrouped(conversations, "exam:1");

		expect(grouped.currentPage.map((item) => item.id)).toEqual(["a", "c"]);
		expect(grouped.otherPages.map((item) => item.id)).toEqual(["b"]);
		expect(grouped.general.map((item) => item.id)).toEqual(["d"]);
	});

	it("filters conversations by context key", () => {
		expect(getConversationsForContext(conversations, "exam:2").map((c) => c.id)).toEqual([
			"b",
		]);
	});
});

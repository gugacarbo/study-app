# Chat Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unused `VirtualizedOutputText` and rewrite `VirtualizedChatMessages` with dynamic `measureElement` for accurate heights and smart auto-scroll.

**Architecture:** Replace fixed `estimateSize` (60/120px) with content-aware estimator + `measureElement` for dynamic resizing. Add near-bottom detection so auto-scroll doesn't interrupt reading. Increase overscan from 5→10. Keep ≤30 fallback unchanged.

**Tech Stack:** @tanstack/react-virtual, @tanstack/ai-client (UIMessage type)

---

### Task 1: Delete VirtualizedOutputText

**Files:**
- Delete: `src/components/ingest/VirtualizedOutputText.tsx`

- [ ] **Step 1: Verify no imports exist**

Run: `rg -l "VirtualizedOutputText" src/`
Expected: Only the component file itself appears (no importers)

- [ ] **Step 2: Delete the file**

Run: `rm src/components/ingest/VirtualizedOutputText.tsx`

- [ ] **Step 3: Verify build still passes**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove unused VirtualizedOutputText component"
```

---

### Task 2: Rewrite VirtualizedChatMessages

**Files:**
- Modify: `src/features/ai/components/chat/virtualized-chat-messages.tsx`

- [ ] **Step 1: Write the new component**

Replace the entire file content with:

```tsx
import type { UIMessage } from "@tanstack/ai-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import type { AssistantPerfMetrics } from "./message/chat-message";
import { ChatMessage } from "./message/chat-message";

interface VirtualizedChatMessagesProps {
	messages: UIMessage[];
	metrics: Record<string, AssistantPerfMetrics | undefined>;
}

function estimateMessageHeight(msg: UIMessage): number {
	if (msg.role === "user") {
		const textLen = msg.parts
			.filter((p) => p.type === "text")
			.reduce((sum, p) => sum + ("content" in p ? String(p.content).length : 0), 0);
		const lines = Math.max(1, Math.ceil(textLen / 60));
		return 52 + lines * 22;
	}
	const toolCallCount = msg.parts.filter(
		(p) => p.type === "tool-call" || p.type === "tool-result",
	).length;
	const textLen = msg.parts
		.filter((p) => p.type === "text")
		.reduce((sum, p) => sum + ("content" in p ? String(p.content).length : 0), 0);
	const textLines = Math.max(1, Math.ceil(textLen / 80));
	return 52 + textLines * 22 + toolCallCount * 90;
}

const NEAR_BOTTOM_THRESHOLD = 150;

export function VirtualizedChatMessages({
	messages,
	metrics,
}: VirtualizedChatMessagesProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const prevMessageCountRef = useRef(0);
	const isNearBottomRef = useRef(true);

	const handleScroll = useCallback(() => {
		const el = parentRef.current;
		if (!el) return;
		const distanceFromBottom =
			el.scrollHeight - el.scrollTop - el.clientHeight;
		isNearBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
	}, []);

	const virtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement: () => parentRef.current,
		estimateSize: (index) => {
			const msg = messages[index];
			if (!msg) return 80;
			return estimateMessageHeight(msg);
		},
		overscan: 10,
		measureElement:
			typeof window !== "undefined"
				? (el: Element | null) => el?.getBoundingClientRect().height
				: undefined,
	});

	useEffect(() => {
		if (
			messages.length > prevMessageCountRef.current &&
			messages.length > 0 &&
			isNearBottomRef.current
		) {
			virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
		}
		prevMessageCountRef.current = messages.length;
	}, [messages.length, virtualizer]);

	if (messages.length <= 30) {
		return (
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">
				{messages.map((msg) => (
					<ChatMessage key={msg.id} message={msg} metrics={metrics[msg.id]} />
				))}
			</div>
		);
	}

	return (
		<div
			ref={parentRef}
			className="min-h-0 flex-1 overflow-y-auto px-4 py-2"
			data-testid="virtualized-chat-messages"
			onScroll={handleScroll}
		>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const message = messages[virtualItem.index];
					if (!message) return null;

					return (
						<div
							key={message.id}
							data-index={virtualItem.index}
							ref={virtualizer.measureElement}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualItem.start}px)`,
								marginBottom: "1rem",
							}}
						>
							<ChatMessage message={message} metrics={metrics[message.id]} />
						</div>
					);
				})}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rewrite VirtualizedChatMessages with dynamic measureElement"
```
# Chat Virtualization Rewrite

**Date:** 2026-06-02
**Status:** Approved

## Problem

Current `virtualized-chat-messages.tsx` has poor performance with many messages:

- Fixed `estimateSize` (60px user / 120px assistant) causes layout shifts when actual heights differ
- `overscan: 5` too low for large messages — flickering on fast scroll
- No gap in virtualized mode but `space-y-4` in fallback — inconsistent layout
- Auto-scroll always fires, even when user is reading older messages

Unused `VirtualizedOutputText.tsx` in ingest should be removed.

## Design

### 1. Delete VirtualizedOutputText

Remove `src/components/ingest/VirtualizedOutputText.tsx`. No importers exist.

### 2. Rewrite VirtualizedChatMessages

**`estimateSize` — content-aware estimator:**

- User messages: 60px base + 20px per text line (count newlines in parts)
- Assistant messages: 120px base + 20px per text line + 80px per tool call/result part
- Fallback: 80px

**`measureElement` — dynamic measurement:**

- Pass `measureElement` as ref callback to each virtual item's wrapper div
- After first render, actual measured heights replace estimates — no more layout shifts

**`overscan: 10`:**

- Increased from 5 to reduce flickering on fast scroll with large messages

**Consistent gap:**

- Virtualized container uses `gap: 1rem` (CSS) to match `space-y-4` in fallback

**Smart auto-scroll:**

- Track `isNearBottom` (within 150px of scroll bottom)
- Only auto-scroll when user is near bottom
- On new message: if near bottom → scroll to last; otherwise → stay put

**Fallback ≤30 messages:** unchanged simple render path.

### Interface (unchanged)

```ts
interface VirtualizedChatMessagesProps {
  messages: UIMessage[];
  metrics: Record<string, AssistantPerfMetrics | undefined>;
}
```

## Files

| Action  | File                                                            |
| ------- | --------------------------------------------------------------- |
| Delete  | `src/components/ingest/VirtualizedOutputText.tsx`               |
| Rewrite | `src/features/ai/components/chat/virtualized-chat-messages.tsx` |

No other files change — component interface remains the same.

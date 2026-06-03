# Components

**Last updated:** 2026-06-03 — feature components moved to `src/features/`

Shared UI components in TanStack Start SPA. Feature-specific components now live in `src/features/{domain}/components/`.

## Structure

Only shared/ui primitives remain here:

| Folder / File       | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `ui/*`              | shadcn/ui primitives (badge, button, card, etc.) |
| `ui/markdown.tsx`   | Markdown → React via `react-markdown` + `remark-gfm` |
| `shimmer-text-span.tsx` | Animated shimmer text placeholder (chat)     |

## Patterns

- shadcn/ui primitives used for all UI elements
- Markdown rendering via `MarkdownRenderer` (`ui/markdown.tsx`) — used across features
- Inline hover styles (onMouseEnter/onMouseLeave) prohibited — use shadcn Button variants instead

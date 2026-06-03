# AI Feature Module

Domain-driven AI integration layer. 50+ files across 10 subdirectories.

## Structure

```
features/ai/
├── agents/          # Domain agents with system prompts + logic
│   ├── chat/        # Chat agent (conversational AI assistant)
│   ├── ingest/      # Ingest agent (PDF → structured questions)
│   ├── explanations/ # Explanation agent (batch deep explanations)
│   ├── quiz/        # Quiz agent (question generation)
│   └── reviewer/    # Reviewer agent (critical-topic verification)
├── core/            # Core generation + chat streaming
├── adapters/        # Provider adapter factory
├── providers/       # Web search/content providers (Tavily)
├── tools/           # Tool registry, resolver, DB + web tools
├── components/      # AI-related UI (chat, config, exam-detail)
├── hooks/           # AI-specific hooks (chat client, auto-title)
├── stores/          # Chat + conversations stores (TanStack Store)
└── utils/           # Shared AI utilities
```

## Agent System

Each agent has `index.ts` (exports) + `system-prompt.ts` (prompt definition) + domain logic.

| Agent | Purpose | Tools Used |
|-------|---------|------------|
| `chat/` | Conversational AI assistant | DB tools, web tools |
| `ingest/` | PDF → structured questions extraction | DB tools |
| `explanations/` | Batch deep explanations for questions | DB tools |
| `quiz/` | Question generation from topics | DB tools |
| `reviewer/` | Critical-topic verification with web research | Web tools (search, fetch) |

## Tool System

- **`tool-registry.ts`** — Defines available tools with Zod schemas
- **`tool-resolver.ts`** — `resolveToolsForAgent()` assembles per-agent tool sets
- **`db-tools.ts`** — Database query tools (exposed to agents via MCP-like interface)
- **`web-tools.ts`** — Web search + content fetch tools (Tavily provider)
- **`reviewer-tool.ts`** — Specialized tool for reviewer agent

## Core

- **`generate.ts`** — AI generation with streaming + structured output
- **`chat-stream.ts`** — Chat streaming via OpenRouter / configurable provider

## Providers

- **`providers/web/tavily-search.ts`** — Tavily web search integration
- **`providers/web/tavily-content.ts`** — Tavily content fetch
- **`providers/web/types.ts`** — Provider type definitions

## Components

| Folder | Purpose |
|--------|---------|
| `components/chat/` | Chat UI: sidebar, messages, input, virtualized list |
| `components/config/` | Test connection dialog |
| `components/exam-detail/` | Explanation generation hook |

## Key Patterns
- **Agent isolation:** Each agent has its own system prompt + domain logic — don't mix
- **Tool resolution:** `resolveToolsForAgent()` determines which tools each agent gets
- **SSE streaming:** Chat + ingest use Server-Sent Events for real-time progress
- **Provider abstraction:** AI providers behind adapter pattern — swap without changing agents
- **Store separation:** `chat-store.ts` for single conversation, `conversations-store.ts` for multi-conversation management

# AI Feature Module

<!-- Last updated: 2026-06-08 -->

Domain-driven AI integration layer. 60+ files across 12 subdirectories.

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
├── tools/           # Tool registry, resolver, DB + web, ingest extraction tools
│   ├── ingest-tools/ # Ingest extraction workspace + tools (add_extracted_question, update_extracted_question)
├── components/      # AI-related UI (chat, config, exam-detail)
├── hooks/           # AI-specific hooks (chat client, auto-title)
├── stores/          # Chat + conversations stores (TanStack Store)
└── utils/           # Shared AI utilities
```

## Agent System

Each agent has `index.ts` (exports) + `system-prompt.ts` (prompt definition) + domain logic.

| Agent           | Purpose                                                          | Tools Used                        |
| --------------- | ---------------------------------------------------------------- | --------------------------------- |
| `chat/`         | Conversational AI assistant                                      | DB tools, web tools               |
| `ingest/`       | PDF → structured questions extraction (tool-based via workspace) | DB tools, ingest extraction tools |
| `explanations/` | Batch deep explanations for questions                            | DB tools                          |
| `quiz/`         | Question generation from topics                                  | DB tools                          |
| `reviewer/`     | Critical-topic verification with web research                    | Web tools (search, fetch)         |

## Tool System

- **`tool-registry.ts`** — Defines available tools with Zod schemas
- **`tool-resolver.ts`** — `resolveToolsForAgent()` assembles per-agent tool sets
- **`db-tools.ts`** — Database query tools (exposed to agents via MCP-like interface)
- **`web-tools.ts`** — Web search + content fetch tools (Tavily provider)
- **`reviewer-tool.ts`** — Specialized tool for reviewer agent
- **`ingest-tools/`** — Ingest extraction workspace + tools (`add_extracted_question`, `update_extracted_question`)
  - `workspace.ts` — Workspace implementation (question storage, lookup by ID)
  - `tools.ts` — Tool definitions for AI function calling
  - `shared.ts` — Shared types and validators

## Core

- **`generate.ts`** — AI generation with streaming + structured output
- **`chat-stream.ts`** — Chat streaming via OpenRouter / configurable provider

## Providers

- **`providers/web/tavily-search.ts`** — Tavily web search integration
- **`providers/web/tavily-content.ts`** — Tavily content fetch
- **`providers/web/types.ts`** — Provider type definitions

## Components

| Folder                                   | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `components/chat/`                       | Chat UI: sidebar, messages, input, virtualized list        |
| `components/config/`                     | Test connection dialog                                     |
| `components/exam-detail/`                | Explanation generation hook                                |
| `components/agent-run-detail-dialog.tsx` | Agent run inspector (system prompt, user prompt, response) |

## Key Patterns

- **Agent isolation:** Each agent has its own system prompt + domain logic — don't mix
- **Tool resolution:** `resolveToolsForAgent()` determines which tools each agent gets
- **SSE streaming:** Chat + ingest use Server-Sent Events for real-time progress
- **Provider abstraction:** AI providers behind adapter pattern — swap without changing agents
- **Store separation:** `chat-store.ts` for single conversation, `conversations-store.ts` for multi-conversation management

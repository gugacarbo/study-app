# AI Feature Module

<!-- Last updated: 2026-06-15 (explain-question review agent + spell tools) -->

Domain-driven AI integration layer. 60+ files across 12 subdirectories.

## Structure

```
features/ai/
├── agents/          # Domain agents with system prompts + logic
│   ├── chat/        # Chat agent (conversational AI assistant)
│   ├── ingest/      # Ingest agent (PDF → structured questions)
│   ├── explanations/ # Per-question explanation agent (explain-question jobs + ingest batch)
│   │   └── explain-question/ # Standalone explain-question job agent (review + apply)
│   ├── quiz/        # Quiz agent (question generation)
│   └── reviewer/    # Reviewer agent (critical-topic verification)
├── core/            # Core generation + UI Message Stream helpers
├── adapters/        # Provider model + provider options
├── providers/       # Web search/content providers (Tavily)
├── tools/           # Tool registry, resolver, DB + web, ingest extraction tools
│   ├── ingest-tools/ # Ingest extraction workspace + tools (add_extracted_question, update_extracted_question)
├── components/      # AI-related UI (chat, config, exam-detail)
├── hooks/           # AI-specific hooks (readonly runtime, auto-title)
├── stores/          # Conversations store (TanStack Store)
├── lib/             # Job stream client, stream response headers
├── types/           # UI Message data parts
└── utils/           # Shared AI utilities
```

## Agent System

Each agent has `index.ts` (exports) + `system-prompt.ts` (prompt definition) + domain logic.

| Agent           | Purpose                                                          | Tools Used                        |
| --------------- | ---------------------------------------------------------------- | --------------------------------- |
| `chat/`         | Conversational AI assistant                                      | DB tools, web tools               |
| `ingest/`       | PDF → structured questions extraction (tool-based via workspace) | DB tools, ingest extraction tools |
| `ingest/review-extraction/` | Per-question review in the ingest pipeline (not `reviewer/`) | Ingest tools + web tools (via `agent.reviewer` resolver) |
| `explanations/explain-question/` | Per-question explanations via explain-question background jobs (review before apply) | Explanation workspace tools + web tools |
| `explanations/` (ingest batch) | Batch explanations during ingest pipeline | Explanation workspace tools |
| `quiz/`         | Question generation from topics                                  | DB tools                          |
| `reviewer/`     | Critical-topic verification in **chat** (`parallel_review` tool) | Web tools (search, fetch)         |

## Tool System

- **`tool-registry.ts`** — Defines available tools with Zod schemas
- **`tool-resolver.ts`** — `resolveToolsForAgent()` assembles per-agent tool sets
- **`db-tools.ts`** — Database query tools (exposed to agents via MCP-like interface)
- **`web-tools.ts`** — Web search + content fetch tools (Tavily provider)
- **`spell-tools/`** — Portuguese spell-check tool (`check_spelling`) for `improve_questions`
- **`reviewer-tool.ts`** — Specialized tool for reviewer agent
- **`ingest-stage-status.ts`** — `report_agent_stage_status` tool + status resolution for ingest pipeline stages
- **`ingest-tools/`** — Ingest extraction workspace + tools (`add_extracted_question`, `update_extracted_question`, `report_agent_stage_status`)
  - `workspace.ts` — Workspace implementation (question storage, lookup by ID)
  - `tools.ts` — Tool definitions for AI function calling
  - `shared.ts` — Shared types and validators

## Core

- **`core/generate/`** — `generateObject` / `streamObject` structured output
- **`core/ai-stream-handler.ts`** — Stream chunk processing for agent runs
- **`core/agent-limits.ts`** — Named step limits (`INGEST_EXTRACTION_MAX_STEPS=15`, `INGEST_PER_QUESTION_MAX_STEPS=12`, `IMPROVE_QUESTIONS_MAX_STEPS=12`)
- **`core/bridge-agent-run-event.ts`** — Bridges per-question agent events to UI Message Stream writers (lifecycle, tokens, tool calls)
- **`core/tool-agent-run.ts`** — Shared stream loop for single-question tool agents (review, explanations); supports `stopWhen` arrays and `prepareStep`
- **`core/tool-agent-stop-when.ts`** — Reusable `stopWhen` / `prepareStep` builders (stage status, workspace no-op, duplicate add, repeated tool calls)
- **`core/map-with-concurrency.ts`** — Parallel mapper used by review/explanation batches
- **`core/ui-message-job-stream.ts`** — `createJobUIMessageStream` + data-part writers for jobs
- **`core/stream-text-compat.ts`** — `streamTextWithCompatibilityFallback` for providers missing text stream parts
- **`lib/read-job-ui-message-stream.ts`** — `consumeJobStream()` client for UI Message Stream jobs

## Providers

- **`providers/web/tavily-search.ts`** — Tavily web search integration
- **`providers/web/tavily-content.ts`** — Tavily content fetch
- **`providers/web/types.ts`** — Provider type definitions

## Components

| Folder                                   | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `components/assistant-ui/`               | Chat UI via `@assistant-ui/react` (thread, composer, tools, `StudyAssistantRuntimeProvider` + DevTools in dev, collapsible prompts on agent-run surfaces) |
| `components/chat/`                       | Chat shell wiring (`chat.tsx` + `useChatRuntime`)          |
| `components/config/`                     | Connection test + benchmark dialogs (per-phase metrics)      |
| `components/agent-run-detail-dialog.tsx` | Agent run inspector (system prompt, user prompt, response) |

## Key Patterns

- **Agent isolation:** Each agent has its own system prompt + domain logic — don't mix
- **Tool resolution:** `resolveToolsForAgent()` determines which tools each agent gets
- **UI Message Stream:** Chat (`/api/chat`) and jobs (ingest, improve-questions, explain-question, test-connection, test-model-benchmark) use AI SDK v6 streams with typed `data-*` parts
- **Benchmark tools:** `tools/benchmark-tools.ts` — synthetic tools for `/api/test-model-benchmark` (add_numbers, echo, delay_ms)
- **Provider abstraction:** `getAiModel()` + `buildProviderOptions()` — swap providers without changing agents
- **Store:** `conversations-store/` for multi-conversation chat; persisted server-side via `server-functions/chat-conversations` (D1 index + R2 `chats/{id}.json` in `MEMORY_BUCKET`); runtime loads last `CHAT_RUNTIME_MESSAGE_LIMIT` messages

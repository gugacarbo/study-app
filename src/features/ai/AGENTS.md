# AI Feature Module

<!-- Last updated: 2026-06-16 (chat DB search escalation + tool loop guards) -->

Domain-driven AI integration layer. 60+ files across 13 subdirectories.

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
├── pipeline/        # Unified job pipeline (server, client, UI) — see Pipeline cookbook
│   ├── server/      # createJobApiRoute, runPipelineStage, runPipelineToolAgent, pipeline-stage-status, …
│   ├── client/      # runJobPipeline, reducers, error helpers
│   └── ui/          # PipelineThread, PipelineLogsPanel, PipelineErrorBanner, …
├── core/            # Core generation + UI Message Stream helpers
├── adapters/        # Provider model + provider options
├── providers/       # Web search/content providers (Tavily)
├── tools/           # Tool registry, resolver, DB + web, ingest extraction tools
│   ├── ingest-tools/ # Ingest extraction workspace + tools
├── components/      # AI-related UI (chat, config, exam-detail)
├── context/         # Page-scoped chat context registry (`page-chat-context`, `page-chat-registry`)
├── hooks/           # AI-specific hooks (auto-title)
├── stores/          # Conversations store (TanStack Store)
├── lib/             # Job stream client, stream response headers, think-tag parsers
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
- **`ingest-tools/`** — Ingest extraction workspace + tools (`add_extracted_question`, `update_extracted_question`; stage status injected by pipeline)
  - `workspace.ts` — Workspace implementation (question storage, lookup by ID)
  - `tools.ts` — Tool definitions for AI function calling
  - `shared.ts` — Shared types and validators

## Core

- **`core/generate/`** — `generateObject` / `streamObject` structured output
- **`core/ai-stream-handler.ts`** — Stream chunk processing; splits think/reasoning XML tags into `onReasoningDelta`
- **`core/agent-limits.ts`** — Named step limits (`INGEST_EXTRACTION_MAX_STEPS=15`, `INGEST_PER_QUESTION_MAX_STEPS=12`, `IMPROVE_QUESTIONS_MAX_STEPS=12`)
- **`core/bridge-agent-run-event.ts`** — Bridges per-question agent events to UI Message Stream writers (lifecycle, tokens, tool calls)
- **`core/tool-agent-run.ts`** — Shared stream loop for single-question tool agents (review, explanations); supports `stopWhen` arrays and `prepareStep`
- **`core/chat-agent-loop.ts`** — Chat `/api/chat` tool loop config (`wrapChatToolsWithCallGuards` + `stopWhen` / `prepareStep`); same pattern as pipeline tool agents
- **`core/tool-agent-stop-when.ts`** — Reusable `stopWhen` / `prepareStep` builders (chat DB search escalation, ingest duplicate add, repeated tool calls)
- **`lib/chat-tool-call-guards.ts`** — Per-turn duplicate call guards + ordered DB search escalation (`topic` → `textContains` → `list_exams` → `examId`)
- **`lib/format-display-tokens.ts`** — Compact UI token counts (`999` → `1.0k` → `20k` → `1.0M`); use for all user-facing token displays
- **`lib/think-tag-stream-parser.ts`** — Incremental think-tag parser for stream text deltas
- **`lib/split-think-tags-ui-stream.ts`** — Chat UI message stream transformer for reasoning parts
- **`core/map-with-concurrency.ts`** — Parallel mapper used by review/explanation batches
- **`core/ui-message-job-stream.ts`** — `createJobUIMessageStream` + data-part writers for jobs
- **`core/stream-text-compat.ts`** — `streamTextWithCompatibilityFallback` for providers missing text stream parts
- **`lib/read-job-ui-message-stream.ts`** — `consumeJobStream()` client for UI Message Stream jobs

## Pipeline cookbook

All long-running AI jobs (ingest, improve-questions, explain-question, test-connection, model-benchmark) use `src/features/ai/pipeline/`. Import from `@/features/ai/pipeline` (barrel) or subpaths `pipeline/server`, `pipeline/client`, `pipeline/ui`.

- **`pipeline/server/pipeline-stage-status.ts`** — Injects `report_agent_stage_status`, merges stop-when, resolves strict stage outcomes for `runPipelineToolAgent` / `runPipelineTextAgent`

### Server (minimal route)

```typescript
export const Route = createFileRoute("/api/my-job/")({
  server: {
    handlers: {
      POST: createJobApiRoute({
        schema: mySchema,
        logTag: "my-job",
        run: async ({ writer, data, agentRuns, log }) => {
          await runPipelineStage(
            writer,
            { stageId: "my_stage", label: "My Agent" },
            async () => {
              const run = agentRuns.createRun("my_stage", "My Agent");
              const emit = createAgentEventEmitter(agentRuns, run);
              const { tools } = resolveToolsForAgent({ agent: "my_agent", /* … */ });
              const result = await runPipelineToolAgent({
                scope: "my-job",
                stageId: "my_stage",
                config,
                run,
                emit,
                systemPrompt: buildSystemPrompt(data),
                messages: [{ role: "user", content: buildUserPrompt(data) }],
                tools,
                stopWhen: stepCountIs(MY_MAX_STEPS),
                isSuccess: ({ streamState }) => streamState.rawText.length > 0,
              });
              if (!result.success) throw new Error(result.reason ?? "Agent failed");
              writeJobResult(writer, { /* domain payload */ });
              return "done";
            },
          );
        },
      }),
    },
  },
});
```

### Client

```typescript
await runJobPipeline({
  request: { url: "/api/my-job", init: { method: "POST", body } },
  handlers: createSingleAgentRunHandlers({
    onStateChange: batcher.queue,
    onResult: finishJob,
  }),
});
```

Multi-agent jobs use `multiAgentRunReducer`; ingest uses `ingestPipelineReducer` + `createIngestPipelineReducer`.

### UI

```tsx
<PipelineErrorBanner error={resolvePipelineError(process)} />
<PipelineStatusBar stepText={process.stepText} isRunning={isStreaming} />
<PipelineThread
  messages={state.messages}
  isRunning={isStreaming}
  mode="readonly"
  layout="panel"
/>
<PipelineLogsPanel logs={process.logs} stepText={process.stepText} compact />
```

Use `usePipelineAssistantRuntime` when wiring assistant-ui thread state from pipeline messages.

## Providers

- **`providers/web/tavily-search.ts`** — Tavily web search integration
- **`providers/web/tavily-content.ts`** — Tavily content fetch
- **`providers/web/types.ts`** — Provider type definitions

## Components

| Folder                                   | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `components/assistant-ui/`               | Chat UI via `@assistant-ui/react` (thread, composer, tools, `StudyAssistantRuntimeProvider` + DevTools in dev, collapsible prompts on agent-run surfaces) |
| `components/chat/`                       | Chat shell + header widget (`header-chat-dock` side layout, `header-chat-context-button`, compact/expanded panels); per-message perf footer; page context via `context/` |
| `components/config/`                     | Connection test + benchmark dialogs (per-phase metrics)      |
| `components/agent-run-detail-dialog.tsx` | Agent run inspector (system prompt, user prompt, response) |

## Key Patterns

- **Agent isolation:** Each agent has its own system prompt + domain logic — don't mix
- **Tool resolution:** `resolveToolsForAgent()` determines which tools each agent gets
- **UI Message Stream:** Chat (`/api/chat`) and jobs use AI SDK v6 streams with typed `data-*` parts; job UIs consume via `pipeline/client` + `pipeline/ui`
- **Chat route:** `routes/api/chat/-schema.ts` (Zod) + `-handlers.ts`; client uses `useChatRuntime` (not `runJobPipeline`); errors via `PipelineErrorBanner` + `errorToPipelineErrorState`
- **Benchmark tools:** `tools/benchmark-tools.ts` — synthetic tools for `/api/test-model-benchmark` (add_numbers, echo, delay_ms)
- **Provider abstraction:** `getAiModel()` + `buildProviderOptions()` — swap providers without changing agents
- **Store:** `conversations-store/` for multi-conversation chat; `context_key` groups page-scoped threads; persisted server-side via `server-functions/chat-conversations` (D1 index + R2 `chats/{id}.json` in `MEMORY_BUCKET`); runtime loads last `CHAT_RUNTIME_MESSAGE_LIMIT` messages
- **Page chat:** routes register context with `registerPageChatContext()`; metadata `pageContext` sent to `/api/chat`; `/api/chat` also streams `metadata.usage` + saves `metadata.custom.perf` (output tokens, duration, tok/s); exam/quiz surfaces use header widget

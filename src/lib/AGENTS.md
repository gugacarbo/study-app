# Library / Infrastructure

Shared utilities, R2+D1 hybrid memory layer, and SSE streaming primitives.

## Submodules

### `memory/` — R2+D1 Hybrid Memory

MemoryManager singleton with lazy init (cached bucket/tables promises). R2 stores full content blobs; D1 stores metadata + search_text for queries. Supports quiz sessions, topic notes, question banks, web research, user stats, and profile content. All content stored as markdown with YAML frontmatter.

### `sse-stream/` — SSE Streaming

Shared SSE utilities consumed by `/api/ingest` and `/api/test-connection`. Events are `\n\n`-delimited blocks with `event:`/`data:` fields. Exports `ingestStream()`, `testConnectionWithStream()`, `parseEventBlock()`, and `createSSEClient()`.

### Root

- `utils.ts` — `cn()` Tailwind class merging helper
- `validation.ts` — Zod schemas: `questionSchema`, `providerConfigSchema`, ingest responses, memory sessions
- `file-service.ts` — `FileService` class wrapping R2 + D1 for exam file storage

## Conventions

- **R2 key prefixes:** `memory/sessions/`, `memory/topics/`, `memory/research/`, `questions/`, `stats/`
- **Lazy bucket resolution:** `resolveBucket()` uses `dynamic import("cloudflare:workers")` — required for Vite bundling compat
- **Content format:** All memory content stored as markdown with YAML frontmatter (`type`, `date`, `topic`)
- **search_text truncation:** D1 column truncated to 4000 chars, whitespace-normalized before storage
- **SSE protocol:** `\n\n`-delimited blocks; each block has `event:` and `data:` lines
- **Logger pattern:** `createIngestLogger()` lazy-imports `DBQueries` to avoid circular dependencies

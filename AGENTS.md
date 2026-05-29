# Study App — Agent Context

**Generated:** 2026-05-28
**Commit:** 6067b81

> **Last auto-updated:** 2026-05-29 — chat AI tools, paginated queries, dynamic imports, formatting

## Overview
Single-user web app for studying college exams using past exams as source material. Upload PDFs → AI extracts questions → interactive quiz mode → progress tracking. Built with TanStack Start + Cloudflare Workers.

## Stack
- **Framework:** TanStack Start (SPA mode), React 19
- **Routing:** TanStack Router (file-based, `src/routes/`)
- **State:** TanStack Store (quiz), TanStack Query (server data)
- **Backend:** Cloudflare Workers + D1 (SQLite)
- **ORM:** Drizzle (`drizzle-orm`) with `drizzle-orm/d1` driver
- **Migrations:** Drizzle Kit (`drizzle-kit`) + wrangler D1 migrations
- **AI:** OpenRouter SDK (`@openrouter/sdk`) — configurable provider/model
- **Validation:** Zod
- **Forms:** react-hook-form + @hookform/resolvers (Zod adapter)
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest + jsdom
- **Linting/Formatting:** Biome v2 (no ESLint/Prettier)
- **Memory:** D1-based memory layer (sessions, topics, documents, profile)

## Environment Variables
| Var | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key (now optional — config-driven API keys supported) |
| `AI_PROVIDER` | No | `openrouter` | AI provider name |
| `AI_MODEL` | No | `openai/gpt-4o-mini` | Model identifier |
| `AI_LOG_LLM` | No | `false` | Enable LLM call logging to D1 |
| `AI_LOG_LLM_CONTENT` | No | `false` | Log LLM request/response content (large) |
| `AI_LOG_LLM_CHUNKS` | No | `false` | Log streaming chunk counts |

## Project Structure
```
src/
├── components/          # UI components
│   ├── ui/              # shadcn/ui primitives (button, card, dialog, etc.)
│   ├── Dashboard.tsx    # Home page — exam list + quick stats
│   ├── ExamDetail.tsx   # Exam detail view with stats, files, questions
│   ├── ExamsView.tsx    # Exam list view with search and delete
│   ├── UploadForm.tsx   # PDF upload + text paste (streaming progress)
│   ├── Quiz.tsx         # Quiz player (question nav, timer, scoring)
│   ├── StatsTable.tsx   # Stats display (plain HTML table)
│   ├── ConfigForm.tsx   # AI provider config form (react-hook-form)
│   ├── ThemeToggle.tsx  # Light/dark mode toggle
│   ├── theme-provider.tsx # Theme context provider (shadcn)
│   ├── Chat.tsx         # AI chat assistant (multi-conversation)  
│   ├── ChatSidebar.tsx  # Conversation list sidebar
│   ├── MemoryPanel.tsx  # Memory overview and search
│   └── MemoryVisualization.tsx # Memory stats dashboard with topic charts
├── routes/              # File-based TanStack Router routes
│   ├── __root.tsx       # Root layout: nav, QueryClient, theme, Scripts
│   ├── index.tsx        # / — Dashboard
│   ├── exams.tsx        # /exams — exam layout (Outlet)
│   ├── exams.index.tsx  # /exams/ — exam list page
│   ├── exams.stats.tsx  # /exams/stats — stats tab page
│   ├── exams.$id.tsx    # /exams/$id — exam detail page
│   ├── quiz.$id.tsx     # /quiz/$id — quiz by exam ID
│   ├── config.tsx       # /config — AI provider settings
│   ├── chat.tsx         # /chat — AI chat interface
│   ├── about.tsx        # /about
│   ├── memory.tsx       # /memory — memory overview (now uses MemoryVisualization)
│   ├── memory-viz.tsx   # /memory-viz — memory visualization dashboard
│   ├── api/             # API route directory (chat, ingest, test-connection)
│   │   ├── chat.ts      # /api/chat — POST handler (server-side API)
│   │   ├── ingest.ts    # /api/ingest — POST handler (streaming ingest)
│   │   └── test-connection.ts # /api/test-connection — SSE streaming test
├── server-functions/    # Server functions + utilities
│   ├── config.ts        # getConfig, setConfig, testConnection
│   ├── ingest.ts        # ingestExam (PDF → questions)
│   ├── quiz.ts          # generateQuiz, submitAnswer
│   ├── stats.ts         # getStats, getExams
│   ├── exams.ts         # getExamDetail, getExamsDetailed, deleteExam, updateQuestion, deleteQuestion
│   ├── memory.ts        # Memory operations (saveQuizSession, getMemoryContext)
│   └── db.ts            # NOT a server fn — D1 helper utility
├── db/
│   ├── schema.ts        # Drizzle schema definitions (9 tables)
│   └── queries.ts       # Drizzle query layer (DBQueries class)
├── lib/
│   ├── ai/              # AI integration module (ai.ts with streaming, prompts/, chat-db-tools.ts)
│   ├── file-service.ts  # File storage and retrieval service
│   ├── memory.ts        # D1-based memory manager
│   ├── utils.ts         # cn() utility for shadcn/ui
│   └── validation.ts    # Zod schemas
├── types/               # TypeScript type augmentation declarations
├── stores/
│   ├── quizStore.ts          # TanStack Store — quiz session state
│   ├── chatStore.ts          # TanStack Store — chat UI state
│   └── conversationsStore.ts # TanStack Store — multi-conversation list + messages
├── router.tsx           # createTanStackRouter + getRouter()
├── routeTree.gen.ts     # Auto-generated by TanStack Router plugin
└── globals.css          # Global styles + Tailwind CSS v4
tests/
├── db/
│   └── db.queries.pagination.test.ts # Paginated list queries tests
├── lib/
│   ├── chat-db-tools.test.ts # Chat AI DB tools tests
│   └── validation.test.ts
└── server-functions/
    ├── config.test.ts
    ├── ingest.test.ts
    └── quiz.test.ts
migrations/
├── 0001_exams.sql       # exams table
├── 0002_questions.sql   # questions table (depends on exams)
├── 0003_attempts.sql    # attempts table (depends on questions)
├── 0004_config.sql      # config table + seed data
├── 0005_files.sql       # files table (depends on exams)
├── 0006_memory.sql      # memory tables (profile, sessions, topic_notes, documents)
├── 0007_questions_deep_explanation.sql # adds deep_explanation column to questions
└── 0008_llm_logs.sql      # LLM call logging table
```

## Commands
| Command | Action |
|---|---|
| `npm run dev` | Local dev server (port 3000) |
| `npm run wrangler:dev` | Wrangler dev mode |
| `npm run build` | Production build |
| `npm run deploy` | Build + wrangler deploy |
| `npm run test` | Vitest run |
| `npm run lint` | Biome lint |
| `npm run format` | Biome format |
| `npm run check` | Biome lint + format check |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Drizzle Kit — generate migration from schema diff |
| `npm run db:generate:local` | Drizzle Kit — generate with explicit config path |
| `npm run db:migrate` | Wrangler D1 migrations (local) |
| `npm run db:migrate:prod` | Wrangler D1 migrations (remote) |
| `npm run db:reset` | Wrangler D1 migrations reset (local) |
| `npm run db:reset:prod` | Wrangler D1 migrations reset (remote) |

**Note:** `postinstall` runs `cf-typegen` + `db:migrate` automatically.

## Key Architectural Decisions
- **Single-user, local-first** — no auth, no multi-tenancy
- **All AI calls server-side** — never in browser
- **D1 via Drizzle ORM** — `src/db/schema.ts` defines tables, `src/db/queries.ts` wraps Drizzle operations
- **Migrations managed by wrangler** — each table has its own migration file (\`0001_exams.sql\` → \`0006_memory.sql\`)
- **SPA mode** (no SSR) — appropriate for single-user app
- **TanStack Store** for quiz state (ephemeral + localStorage persistence) and chat state, **TanStack Query** for server data
- **PDF parsing** via text extraction; fallback to manual paste
- **Server functions** use `createServerFn` from `@tanstack/react-start` with `data` parameter pattern
- **Deep explanations** generated in batches by AI agent, stored in `deep_explanation` column; shown as collapsible in quiz results
- **Quiz answer evaluation** uses direct string comparison (not AI) — faster, cheaper, deterministic
- **Quiz state persisted** to localStorage — survives page refresh, keyed by exam/topic
- **Config form** uses `react-hook-form` + `@hookform/resolvers` (Zod adapter) — not `@tanstack/react-form`
- **Markdown rendering** via `react-markdown` + `remark-gfm` with custom component overrides (inline code, blockquotes, tables, lists); used for AI-generated explanations, questions, options, and profile summaries across exam-detail, quiz, and memory-panel
- **Multi-conversation chat** with `conversationsStore` (TanStack Store + localStorage persistence) — conversations sidebar, auto-title from first user message, new/delete/switch via `ChatSidebar`
- **Streaming ingest progress** — upload form shows real-time AI streaming text (token-by-token), live estimated token count, and spinner instead of static progress bar; SSE `chunk` and `token` events from `/api/ingest`
- **Full-width layout mode** — root layout uses `has-[[data-fullwidth]]:max-w-full` to allow children (e.g., chat) to opt into full-width via `data-fullwidth` attribute

## Memory Layer (D1-Based)
- **Storage:** D1 database tables (`memory_profile`, `memory_sessions`, `memory_topic_notes`, `memory_documents`)
- **Migration file:** `0006_memory.sql` — creates all 4 memory tables with indexes
- **Schema:** Defined in `src/db/schema.ts` (10 tables total) — includes `llm_logs` for API call logging
- **LLM Logging:** `llm_logs` table stores AI call metadata (provider, model, duration, tokens, status). Enable via `AI_LOG_LLM`, `AI_LOG_LLM_CONTENT`, `AI_LOG_LLM_CHUNKS` env vars.
- **Server functions:** `src/server-functions/memory.ts` — `saveQuizSessionToMemory`, `getMemoryContext`
- **Context injection:** Before AI calls, `getMemoryContext` queries recent sessions, topic notes, and profile → injects into system prompt

## Known Gotchas
- `pdf-parse` doesn't work in CF Workers — text extraction fallback
- OpenRouter rate limits may require retry logic
- Biome VCS integration disabled — ignores `.gitignore`
- `@tanstack/react-router-ssr-query` and `axios` are unused dependencies
- `#/*` path alias in `package.json` imports is unused — use `@/*` instead; but `#/*` is used by `chat.tsx` for `#/components/chat-sidebar` import via the `imports` field
- No CI pipeline — quality checks are manual
- D1 `database_id: "DEV"` hardcoded in wrangler.jsonc; production DB injected at deploy
- Drizzle `d1-http` driver is for migration generation only; runtime uses `drizzle-orm/d1`
- Test mocks must support `stmt.bind(...).raw()` for Drizzle D1 compatibility
- `db:reset` drops all tables — use with caution (local only)
- File blobs stored in D1 `files` table (content column) — large files may hit D1's 1MB row limit
- `getDB()` in `src/server-functions/db.ts` uses dynamic `import("cloudflare:workers")` with `/* @vite-ignore */` — required because static imports of Workers-only modules break Vite bundling in non-Workers contexts. API routes (`chat.ts`, `ingest.ts`, `test-connection.ts`) also use dynamic imports of `getDB` at the call site.

<!-- intent-skills:start -->
# Skill mappings - load `use` with `npx @tanstack/intent@latest load <use>`.
skills:
  - when: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
    use: "@tanstack/devtools#devtools-app-setup"
  - when: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
    use: "@tanstack/devtools#devtools-marketplace"
  - when: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
    use: "@tanstack/devtools#devtools-plugin-panel"
  - when: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
    use: "@tanstack/devtools#devtools-production"
  - when: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
    use: "@tanstack/devtools-event-client#devtools-bidirectional"
  - when: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
    use: "@tanstack/devtools-event-client#devtools-event-client"
  - when: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
    use: "@tanstack/devtools-event-client#devtools-instrumentation"
  - when: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
    use: "@tanstack/devtools-vite#devtools-vite-plugin"
  - when: "Step-by-step migration from Next.js App Router to TanStack Start: route definition conversion, API mapping, server function conversion from Server Actions, middleware conversion, data fetching pattern changes."
    use: "@tanstack/react-start#lifecycle/migrate-from-nextjs"
  - when: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
    use: "@tanstack/react-start#react-start"
  - when: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
    use: "@tanstack/react-start#react-start/server-components"
  - when: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
    use: "@tanstack/router-core#router-core"
  - when: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
    use: "@tanstack/router-core#router-core/auth-and-guards"
  - when: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
    use: "@tanstack/router-core#router-core/code-splitting"
  - when: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
    use: "@tanstack/router-core#router-core/data-loading"
  - when: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
    use: "@tanstack/router-core#router-core/navigation"
  - when: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
    use: "@tanstack/router-core#router-core/not-found-and-errors"
  - when: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
    use: "@tanstack/router-core#router-core/path-params"
  - when: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
    use: "@tanstack/router-core#router-core/search-params"
  - when: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
    use: "@tanstack/router-core#router-core/ssr"
  - when: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
    use: "@tanstack/router-core#router-core/type-safety"
  - when: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
    use: "@tanstack/router-plugin#router-plugin"
  - when: "Core overview for TanStack Start: tanstackStart() Vite plugin, getRouter() factory, root route document shell (HeadContent, Scripts, Outlet), client/server entry points, routeTree.gen.ts, tsconfig configuration. Entry point for all Start skills."
    use: "@tanstack/start-client-core#start-core"
  - when: "Server-side authentication primitives for TanStack Start: session cookies (HttpOnly, Secure, SameSite, __Host- prefix), session read/issue/destroy via createServerFn and middleware, OAuth authorization-code flow with state and PKCE, password-reset enumeration defense, CSRF for non-GET RPCs, rate limiting auth endpoints, session rotation on privilege change. Pairs with router-core/auth-and-guards for the routing side."
    use: "@tanstack/start-client-core#start-core/auth-server-primitives"
  - when: "Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker, Bun, Railway. Selective SSR (ssr option per route), SPA mode, static prerendering, ISR with Cache-Control headers, SEO and head management."
    use: "@tanstack/start-client-core#start-core/deployment"
  - when: "Isomorphic-by-default principle, environment boundary functions (createServerFn, createServerOnlyFn, createClientOnlyFn, createIsomorphicFn), ClientOnly component, useHydrated hook, import protection, dead code elimination, environment variable safety (VITE_ prefix, process.env)."
    use: "@tanstack/start-client-core#start-core/execution-model"
  - when: "createMiddleware, request middleware (.server only), server function middleware (.client + .server), context passing via next({ context }), sendContext for client-server transfer, global middleware via createStart in src/start.ts, middleware factories, method order enforcement, fetch override precedence."
    use: "@tanstack/start-client-core#start-core/middleware"
  - when: "createServerFn (GET/POST), inputValidator (Zod or function), useServerFn hook, server context utilities (getRequest, getRequestHeader, setResponseHeader, setResponseStatus), error handling (throw errors, redirect, notFound), streaming, FormData handling, file organization (.functions.ts, .server.ts)."
    use: "@tanstack/start-client-core#start-core/server-functions"
  - when: "Server-side API endpoints using the server property on createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE), createHandlers for per-handler middleware, handler context (request, params, context), request body parsing, response helpers, file naming for API routes."
    use: "@tanstack/start-client-core#start-core/server-routes"
  - when: "Server-side runtime for TanStack Start: createStartHandler, request/response utilities (getRequest, setResponseHeader, setCookie, getCookie, useSession), three-phase request handling, AsyncLocalStorage context."
    use: "@tanstack/start-server-core#start-server-core"
  - when: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."
    use: "@tanstack/virtual-file-routes#virtual-file-routes"
<!-- intent-skills:end -->

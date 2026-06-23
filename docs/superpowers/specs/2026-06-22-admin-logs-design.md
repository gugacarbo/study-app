# Admin logs — LLM & R2 visualization

**Date:** 2026-06-22
**Spec:** SPEC-0015 (`docs/specs/admin/0015-admin-logs.md`)
**ADR:** ADR-0005 (append-only audit log)

## Goal

Admin-only screens at `/admin/llm-logs` and `/admin/r2-logs` for read-only visualization of LLM request logs and R2 operation logs. Summary statistics cards, time-series charts, filterable/paginated tables, and individual log detail sheets. Per-user filtering supported alongside aggregated views. No write actions — ADR-0005 prohibits DELETE/UPDATE on log tables.

## Routes and navigation

- `/admin/llm-logs` → `AdminLlmLogsPage`
- `/admin/r2-logs` → `AdminR2LogsPage`
- Two new items in admin sidebar: "LLM Logs" and "R2 Logs"
- Each route is independent in sidebar (same pattern as Config, Usuários, Jobs)
- Admin guard via `requireAdminSession` already on the layout route
- `src/lib/admin-nav.ts` gains 2 entries in `ADMIN_NAV_ITEMS`

## Page layout (4 zones, top to bottom)

```
┌─────────────────────────────────────────────┐
│  Cards de Resumo (4 cards em grid)          │
│  [Total requests] [Sucesso] [Erro] [Latência média]
├─────────────────────────────────────────────┤
│  Gráfico Temporal                           │
│  [Seletor: hora | dia] [Seletor: usuário]  │
├─────────────────────────────────────────────┤
│  Tabela com Filtros e Paginação             │
│  [Filtros: status, provider, modelo, data]  │
│  [Paginação server-side]                    │
├─────────────────────────────────────────────┤
│  Sheet de Detalhe (slide-over lateral)      │
│  Abre ao clicar numa linha da tabela        │
│  Todos os campos do schema                  │
└─────────────────────────────────────────────┘
```

### Stats cards

**LLM**: Total de requests, Sucesso, Erro, Latência média (ms)
**R2**: Total de operações, Sucesso, Erro, Volume total (bytes)

### Time chart

- Granularity selector: hour (`strftime('%Y-%m-%d %H:00', created_at)`) / day (`strftime('%Y-%m-%d', created_at)`)
- User selector: all users or specific user from dropdown
- Chart type: area chart via Recharts + shadcn `Chart` wrapper

### Table

- Server-side pagination (`LIMIT + OFFSET`; v1 — cursor-based if volume grows)
- Filters: shared (`status`, `dateFrom`, `dateTo`, `userId`) + domain-specific (`provider`/`model`/`callType` for LLM; `bucket`/`operation` for R2)
- Click on row → opens detail sheet

### Detail sheet

- All schema fields displayed
- LLM-specific: `call_type`, `provider`, `model`, `base_url`, `system_prompt`, `request_payload`, `response_payload`, `token_meta`, `duration_ms`, `chunks`, `final_chars`
- R2-specific: `bucket`, `operation`, `object_key`, `bytes`, `duration_ms`
- Payloads > 2000 chars truncated with "mostrar mais" toggle
- Status badges: green (success), red (error), yellow (pending)

## Data flow and server functions

Each route makes 3 independent queries via TanStack Query:

| Query key | Purpose | Server function | Method |
|---|---|---|---|
| `admin/llm-logs/stats` | Stats cards aggregation | `getLlmLogsStats(filters)` | GET |
| `admin/llm-logs/time-series` | Time chart data | `getLlmLogsTimeSeries(granularity, filters)` | GET |
| `admin/llm-logs/list` | Paginated table | `getLlmLogsPage(page, pageSize, filters)` | GET |
| `admin/r2-logs/stats` | Stats cards aggregation | `getR2LogsStats(filters)` | GET |
| `admin/r2-logs/time-series` | Time chart data | `getR2LogsTimeSeries(granularity, filters)` | GET |
| `admin/r2-logs/list` | Paginated table | `getR2LogsPage(page, pageSize, filters)` | GET |
| `admin/logs/users` | User dropdown filter | `getUsersForFilter()` | GET |

All admin server functions call `requireAdminSession(headers)` before querying.

### Filters

**Shared**: `userId?`, `status?`, `dateFrom?`, `dateTo?`
**LLM-only**: `provider?`, `model?`, `callType?`
**R2-only**: `bucket?`, `operation?`

### Queries (D1)

- Aggregations use `GROUP BY` directly in D1 — no in-worker aggregation
- Time series uses `strftime` for grouping by hour or day
- User dropdown: `getUsersForFilter()` returns `id` + `email`, cached 5 min
- Pagination: `LIMIT + OFFSET` with `ORDER BY created_at DESC, id DESC`

## Shared components

All shared components live in `src/features/admin/components/logs/`:

| Component | Props | Description |
|---|---|---|
| `LogsStatsCards` | `cards: StatCard[]` | Grid of 4 summary cards |
| `LogsTimeChart` | `data, granularity, onGranularityChange` | Area chart with granularity toggle |
| `LogsTable` | `columns, data, filters, pagination` | Generic table with filters and server-side pagination |
| `LogsDetailSheet` | `open, onClose, title, fields` | Slide-over sheet with all log fields |
| `LlmLogDetail` | `log: LlmLogDetail` | LLM-specific field renderer for detail sheet |
| `R2LogDetail` | `log: R2LogDetail` | R2-specific field renderer for detail sheet |
| `LlmLogsFilters` | `filters, onChange` | LLM filter bar |
| `R2LogsFilters` | `filters, onChange` | R2 filter bar |

## File structure

```
src/routes/admin/
  llm-logs/index.tsx
  r2-logs/index.tsx

src/features/admin/
  components/logs/
    logs-stats-cards.tsx
    logs-time-chart.tsx
    logs-table.tsx
    logs-detail-sheet.tsx
    llm-log-detail.tsx
    r2-log-detail.tsx
    llm-logs-filters.tsx
    r2-logs-filters.tsx
  hooks/
    use-admin-llm-logs.ts
    use-admin-r2-logs.ts
    use-admin-logs-users.ts
  pages/
    admin-llm-logs-page.tsx
    admin-r2-logs-page.tsx

src/functions/admin/
  llm-logs-stats.ts
  llm-logs-time-series.ts
  llm-logs-list.ts
  r2-logs-stats.ts
  r2-logs-time-series.ts
  r2-logs-list.ts
  logs-users.ts

src/db/queries/
  llm-logs-admin.ts
  r2-logs-admin.ts
```

## Dependencies

- `recharts` — via shadcn `Chart` wrapper (project already has `--chart-1`..`--chart-5` CSS vars)
- shadcn components to add: `chart`, `sheet`, `select`, `popover` + `calendar` (date filter)
- Zod schemas for filter validation on server functions

## Edge cases

- **Zero logs**: cards show `0`/`—`, chart shows empty state message, table shows "Nenhum log encontrado"
- **User with no logs**: same empty treatment, with user name in header
- **Large payloads**: `request_payload`/`response_payload` truncated at 2000 chars with "mostrar mais" toggle
- **Pending status**: included in filters and counts; yellow badge in detail sheet
- **Deleted users**: `user_id` without matching `user` — show email if found, else truncated ID
- **Admin sees all users**: queries are not scoped to admin's own `user_id`

## Constraints (ADR-0005)

- No write actions on log tables — read-only UI
- No export buttons — out of scope for v1
- No delete or update — append-only per ADR-0005
- Admin role grants access to all users' logs, not just own

## Testing

- Unit tests on DB queries (`llm-logs-admin.ts`, `r2-logs-admin.ts`) with in-memory D1
- Integration tests on server functions (status codes, filter combinations, pagination)
- Component tests on filters and table rendering

## Out of scope (v1)

- Export (CSV/JSON), real-time updates (WebSocket), log retention/purge UI, R2 object content preview, cross-log correlation
---
status: implemented
date: 2026-06-17
builds-on: [ADR-0009, ADR-0004, SPEC-0004]
implemented-by:
  - src/db/queries/jobs.ts
  - src/lib/job-kinds.ts
  - src/functions/admin/jobs.ts
  - src/functions/jobs/cancel-job.ts
  - src/features/admin/hooks/use-admin-jobs.ts
  - src/features/admin/components/jobs-table.tsx
  - src/features/admin/components/job-detail-content.tsx
  - src/features/admin/components/job-detail-sheet.tsx
  - src/features/admin/pages/admin-jobs-page.tsx
  - src/features/admin/lib/job-labels.ts
  - src/routes/admin/jobs/index.tsx
  - src/features/admin/components/admin-shell.tsx
---

# Admin: visualização de background jobs

> Convenções: `docs/context/CONVENTIONS.md` · Jobs: ADR-0009 · RBAC: ADR-0004 · Ingest: SPEC-0004

## Objetivo

Administrador (`admin:access`) visualiza os últimos background jobs de **todos os usuários**, inspeciona detalhes (metadata, eventos, fases) e pode cancelar jobs ativos cross-user.

Sem `admin:access`, `/admin/jobs` responde **404** (via guard da área admin).

## Escopo v1

### Lista (`/admin/jobs`)

- Últimos **100** jobs, `ORDER BY created_at DESC`
- Colunas: email do usuário, kind, status (+ fase se houver), criado em, erro truncado
- Clique na linha abre Sheet de detalhe

### Detalhe (Sheet)

- Campos do job: id, userId, kind, status, phase, error, timestamps, `cancel_requested_at`
- Metadata formatada para `ingest`; JSON bruto para outros kinds
- Timeline de eventos (`background_job_events`, todos os `seq`)
- Poll a cada **2s** enquanto status ∈ `{awaiting_upload, queued, running}`

### Cancelamento admin

- Botão visível só em status canceláveis (mesmos de `POST /api/jobs/:id/cancel`)
- `window.confirm` antes de enviar
- Usa `getJobByIdInternal` — sem checagem de ownership

## Server functions (não REST público)

| Função | Método | Auth |
|--------|--------|------|
| `listAdminJobs` | GET | `requireAdminSession` |
| `getAdminJobDetail` | GET `{ jobId }` | `requireAdminSession` |
| `cancelAdminJob` | POST `{ jobId }` | `requireAdminSession` |

Handlers em `src/functions/admin/jobs.ts`. Query `listJobsForAdmin` em `src/db/queries/jobs.ts`.

## Fora do escopo v1

- Filtros por status/kind/usuário
- Paginação cursor além do limit 100
- SSE no admin
- Retry / delete de jobs

## Definition of Done

```bash
npm run typecheck
npm test -- src/db/queries/jobs.test.ts
npm test -- src/functions/admin/jobs.test.ts
npm test -- src/features/admin/pages/admin-jobs-page.spec.tsx
test -f src/routes/admin/jobs/index.tsx
grep -q 'Jobs' src/features/admin/components/admin-shell.tsx
grep -rq 'listJobsForAdmin' src/db/queries/jobs.ts
grep -rq 'requireAdminSession' src/functions/admin/jobs.ts
npm run docs-check
```

## Verificação

```bash
npm run typecheck
npm test -- src/db/queries/jobs.test.ts src/functions/admin/jobs.test.ts src/features/admin/pages/admin-jobs-page.spec.tsx
grep -q 'Jobs' src/features/admin/components/admin-shell.tsx
test -f src/routes/admin/jobs/index.tsx
```

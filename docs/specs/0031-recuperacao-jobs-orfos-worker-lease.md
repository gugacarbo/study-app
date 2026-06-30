---
status: implemented
date: 2026-06-30
builds-on: [ADR-0004, ADR-0008, ADR-0009, SPEC-0001, SPEC-0004, SPEC-0016]
implemented-by:
  - migrations/0010_orphan_worker_leases.sql
  - src/db/schema/jobs.ts
  - src/db/queries/jobs.ts
  - src/lib/job-processing.ts
  - src/functions/jobs/reconcile-stale-jobs.ts
  - src/functions/jobs/get-job-events.ts
  - src/functions/admin/jobs.ts
  - src/workers/job-consumer.ts
  - src/workers/cron.ts
  - src/features/ai/jobs/run-job-consumer.ts
  - src/features/ai/jobs/ingest/run-ingest/orchestrator.ts
  - src/features/background-processes/hooks/use-job-sync.ts
  - src/features/background-processes/lib/jobs-api.ts
  - src/features/background-processes/pages/job-monitor-page.tsx
  - src/features/admin/hooks/use-admin-jobs.ts
  - src/features/admin/components/job-detail-content.tsx
  - src/features/admin/components/job-detail-sheet.tsx
  - src/features/admin/pages/admin-jobs-page.tsx
  - wrangler.jsonc
---

# Recuperar jobs órfãos com lease e heartbeat de worker

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Orquestração Queue + D1:
> `docs/adr/0009-background-jobs-server-side.md`. Esta spec fecha a recuperação de jobs
> presos em `queued`/`running` quando a Queue ou o worker não concluem a transição terminal.

## Objetivo

Permitir que o sistema diferencie:

- job realmente em processamento por um worker vivo;
- job `queued` sem mensagem útil na Queue;
- job `running` cujo worker morreu ou perdeu a lease.

Quando o processamento estiver órfão, o sistema deve conseguir:

- **cancelar** o job se já houver `cancel_requested_at`;
- **re-enfileirar** o job quando a estratégia do kind permitir retomada segura;
- **falhar** explicitamente quando a recuperação automática exceder o limite.

## Fluxo

1. API cria ou atualiza job para `queued` e limpa qualquer lease anterior.
2. Consumer recebe `{ jobId }`, gera `workerId` efêmero e tenta **claim atômico** do job:
   `status` deve ser `queued`; claim bem-sucedido move para `running` e grava lease.
3. Worker em execução atualiza `heartbeat_at` e estende `lease_expires_at` durante o job.
4. Enquanto `lease_expires_at > now`, o job é considerado **ativo**; cancelamento continua cooperativo
   via `cancel_requested_at`.
5. Scheduler roda reconciliador periódico e busca jobs órfãos:
   - `queued` sem progresso acima do limite;
   - `running` com lease expirada.
6. Reconciliador aplica a política do kind:
   - se houver cancel pendente e não houver worker vivo, finaliza `cancelled`;
   - se o kind permitir recuperação, volta para `queued`, normaliza estado parcial e re-enfileira;
   - se o limite de recuperação estourar, finaliza `failed` com erro explícito.
7. Admin vê o estado da lease no detalhe do job e pode disparar recuperação manual de um job stale.
8. Monitor do usuário continua baseado em D1, mas passa a exibir se o processamento está ativo,
   aguardando recuperação ou já recebeu cancelamento sem worker vivo.

## Contrato

### Schema (`background_jobs`)

Adicionar colunas explícitas em `background_jobs`:

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `worker_id` | `text null` | identificador efêmero do worker que segurou a lease por último |
| `processing_started_at` | `text null` | primeiro instante em que o job entrou em `running` na tentativa atual |
| `heartbeat_at` | `text null` | último heartbeat persistido pelo worker |
| `lease_expires_at` | `text null` | deadline após o qual o worker deixa de ser considerado vivo |
| `run_attempts` | `integer not null default 0` | total de claims bem-sucedidos do consumer |
| `recovery_attempts` | `integer not null default 0` | total de recuperações automáticas ou manuais |
| `last_recovered_at` | `text null` | timestamp da última recuperação aplicada |

Regras:

- `queued` e estados terminais devem manter `worker_id`, `processing_started_at`, `heartbeat_at`
  e `lease_expires_at` nulos.
- `running` deve sempre persistir os quatro campos de lease.
- `updated_at` não substitui `heartbeat_at`; heartbeat é a fonte de verdade de liveness.

### Vocabulário de status

`status` **não muda** nesta spec:

`awaiting_upload` | `queued` | `running` | `completed` | `failed` | `cancelled`

Liveness passa a ser derivado por lease, não por `status` sozinho.

### Estados derivados de processamento

Estado derivado usado por monitor/admin:

| Estado derivado | Regra |
| --- | --- |
| `idle` | `status` terminal ou `awaiting_upload` |
| `queued` | `status=queued` e abaixo do limiar de fila órfã |
| `active` | `status=running` e `lease_expires_at > now` |
| `stale-queued` | `status=queued` e sem progresso acima de `JOB_QUEUE_STALE_AFTER_MS` |
| `stale-running` | `status=running` e `lease_expires_at <= now` |
| `recovering` | job que acabou de ser normalizado para `queued` e aguarda novo dispatch |

### Timers e limites

Constantes v1:

| Constante | Valor inicial | Uso |
| --- | --- | --- |
| `JOB_HEARTBEAT_INTERVAL_MS` | `15_000` | frequência-alvo dos heartbeats |
| `JOB_LEASE_TTL_MS` | `90_000` | janela máxima sem heartbeat para considerar `running` ativo |
| `JOB_QUEUE_STALE_AFTER_MS` | `120_000` | tempo máximo aceitável para `queued` sem claim |
| `JOB_RECOVERY_MAX_ATTEMPTS` | `3` | limite de re-enfileiramentos por job |
| `JOB_RECOVERY_CRON` | `* * * * *` | reconciliador a cada minuto |

O TTL deve ser maior que o maior período silencioso esperado entre steps/streams do job.

### Claim do consumer

O consumer não pode mais confiar apenas em `getJobByIdInternal()` + `status === queued`.
Ele deve usar claim atômico:

1. `UPDATE background_jobs ... WHERE id = ? AND status = 'queued'`
2. no mesmo patch, gravar:
   - `status = 'running'`
   - `worker_id = <uuid>`
   - `processing_started_at = CURRENT_TIMESTAMP`
   - `heartbeat_at = CURRENT_TIMESTAMP`
   - `lease_expires_at = now + JOB_LEASE_TTL_MS`
   - `run_attempts = run_attempts + 1`
3. se nenhuma linha for alterada, o consumer deve `ack` e sair sem processar o job.

### Heartbeat

Todo job `running` deve renovar a lease:

- antes de iniciar cada phase principal;
- depois de cada phase concluída;
- durante loops/streams longos;
- antes de waits/retries superiores ao intervalo de heartbeat.

Atualização mínima:

```ts
{
  heartbeatAt: now,
  leaseExpiresAt: now + JOB_LEASE_TTL_MS
}
```

Estados terminais devem limpar a lease.

### Reconciliador automático

O reconciliador roda no `scheduled` do worker principal e opera sobre jobs do usuário todo,
não só do admin atual.

#### `queued` órfão

Se `status=queued` e `updated_at` ultrapassar `JOB_QUEUE_STALE_AFTER_MS`:

- se `recovery_attempts < JOB_RECOVERY_MAX_ATTEMPTS`, re-enfileirar o job e gravar:
  - `recovery_attempts += 1`
  - `last_recovered_at = now`
  - evento textual curto, ex.: `Dispatch do job não avançou; tentando novamente.`
- se o limite estourar, finalizar `failed` com erro `job_dispatch_stalled`.

#### `running` órfão

Se `status=running` e `lease_expires_at <= now`:

- com `cancel_requested_at != null`: finalizar `cancelled`, limpar lease e registrar evento textual
  `Cancelamento concluído após detectar worker inativo.`
- sem cancel pendente e `recovery_attempts < JOB_RECOVERY_MAX_ATTEMPTS`:
  - aplicar estratégia de recuperação por kind;
  - voltar para `queued`;
  - limpar lease;
  - `recovery_attempts += 1`;
  - `last_recovered_at = now`;
  - re-enfileirar.
- sem cancel pendente e limite esgotado: finalizar `failed` com erro
  `job_recovery_exhausted`.

### Estratégia por kind

| Kind | Estratégia ao recuperar `running` órfão |
| --- | --- |
| `ingest` | reinicia do começo do pipeline; persistência continua protegida por dedup e append-only |
| `improve-questions` | reseta itens/contadores `running` de volta para `queued`, preserva `completed`, `failed` e `cancelled`, depois re-enfileira |
| kind sem estratégia declarada | não re-enfileira automaticamente; finaliza `failed` com `job_kind_not_recoverable` |

Para `improve-questions`, a normalização obrigatória antes do requeue é:

- cada item `status=running` volta para `status=queued`;
- `runningCount` decrementa;
- `queuedCount` incrementa na mesma quantidade;
- phase volta para `dispatching_agents` ou `processing_questions`, conforme houver itens concluídos.

### Cancelamento

`POST /api/jobs/:id/cancel` mantém o comportamento atual para `awaiting_upload`, `queued` e `failed`.

Para `running`:

- se a lease estiver ativa, o endpoint só grava `cancel_requested_at`;
- se a lease já estiver stale, o endpoint ainda não assume cancelamento imediato sozinho:
  o reconciliador ou a ação manual de recuperação é quem deve terminalizar o job.

Isso evita corrida entre relógio local do request e heartbeat real do worker.

### APIs de leitura

`GET /api/jobs/:id/events` adiciona um bloco derivado:

```ts
processing: {
  state: "idle" | "queued" | "active" | "stale-queued" | "stale-running" | "recovering";
  heartbeatAt: string | null;
  leaseExpiresAt: string | null;
  recoveryAttempts: number;
}
```

Admin detail adiciona campos brutos:

- `workerId`
- `processingStartedAt`
- `heartbeatAt`
- `leaseExpiresAt`
- `runAttempts`
- `recoveryAttempts`
- `lastRecoveredAt`

### Recuperação manual no admin

Novo server function:

| Função | Método | Auth |
| --- | --- | --- |
| `recoverAdminJob` | POST `{ jobId }` | `requireAdminSession` |

Contrato:

- disponível só para jobs em `stale-queued` ou `stale-running`;
- aplica a mesma política do reconciliador automático;
- retorna `{ ok: true, action: "requeued" | "cancelled" | "failed" }`;
- se a lease voltou a ficar ativa antes da mutation, responde conflito lógico sem sobrescrever o worker vivo.

### UI do monitor e admin

Monitor do usuário:

- quando `processing.state = active`, comportamento atual;
- quando `processing.state = stale-running` e `cancel_requested_at != null`, mostrar copy
  “Cancelamento aguardando recuperação do worker”;
- quando `processing.state` for stale sem cancel, mostrar alerta passivo
  “Processamento aguardando retomada automática”.

Admin:

- detalhe do job mostra lease state derivado;
- botão “Recuperar job” visível só em estados stale;
- botão “Cancelar job” continua escondido após `cancel_requested_at`, mas o detalhe informa se o
  cancel ainda depende de recuperação.

## Casos de borda

| # | QUANDO | o sistema DEVE |
| --- | ------ | -------------- |
| 1 | o worker cai depois de mover o job para `running`, antes do próximo heartbeat | marcar o job como `stale-running` após `lease_expires_at` |
| 2 | a Queue reentrega uma mensagem antiga de job já recuperado | o claim atômico falha e o consumer faz `ack` sem reprocessar |
| 3 | o job fica `queued` mas a mensagem nunca chega ao consumer | o reconciliador re-enfileira até o limite de recuperação |
| 4 | o usuário pede cancelamento de job `running` com worker morto | manter `cancel_requested_at` e deixar o reconciliador concluir `cancelled` |
| 5 | o job termina normalmente | limpar lease e não deixá-lo aparecer como stale em leituras futuras |
| 6 | duas recuperações manuais concorrentes tentam agir sobre o mesmo job stale | apenas a primeira mutação válida altera a linha; a outra deve observar conflito e não duplicar enqueue |
| 7 | `improve-questions` tem itens `running` quando o worker morre | resetar só os itens `running`; `completed`/`failed` continuam imutáveis |
| 8 | `recovery_attempts` atinge o limite | o job termina em `failed` com erro explícito em vez de ficar preso |

## Questões em aberto

(nenhuma)

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/workers/job-consumer src/functions/jobs src/functions/admin/jobs src/features/background-processes
npm run docs-check
```

## Revisão humana

- Conferir se os textos de recuperação/cancelamento no monitor ficam claros para usuário não técnico.
- Validar se o nível de detalhe exposto no admin é suficiente para suporte sem virar ruído.

## Verificação

```text
npm test -- --run src/workers/job-consumer src/functions/jobs src/functions/admin/jobs src/features/background-processes
21 arquivos de teste, 150 testes, tudo verde

npm run typecheck
falhou apenas por erros preexistentes fora deste escopo em:
- src/features/exams/components/exam-improve-questions-dialog.spec.tsx
- src/features/exams/components/exam-question-item.spec.tsx
- src/features/exams/components/question-edit-form.tsx
- src/features/exams/hooks/use-improve-questions-job.spec.tsx
```

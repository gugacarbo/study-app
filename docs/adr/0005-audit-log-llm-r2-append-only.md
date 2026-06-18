---
status: accepted
date: 2026-06-17
builds-on: [ADR-0002, ADR-0003, ADR-0004]
deciders: []
---

# Registrar ações de LLM e R2 em log append-only

## Contexto e problema

Chamadas a LLMs e operações em R2 são difíceis de auditar, custear e depurar sem trilha persistente. O app precisa de registro **obrigatório**, **completo** e **irreversível** (sem exclusão pela aplicação) para toda requisição a modelo e todo acesso de leitura/escrita em buckets.

## Direcionadores da decisão

- Rastreabilidade por `user_id` (sessão — ADR-0003)
- Append-only na aplicação — sem purge admin em v1
- Um único ponto de instrumentação (não log ad-hoc por feature)
- Falha de log não deve silenciar a operação principal, mas deve ser visível (erro + métrica)
- Metadados sempre gravados

## Opções consideradas

| Opção                                             | Veredito                                                |
| ------------------------------------------------- | ------------------------------------------------------- |
| D1 append-only (`llm_logs` + `r2_operation_logs`) | **Escolhida** — mesmo binding, queries por usuário      |
| Só `console.log` / Observability Workers          | Sem consulta histórica nem UI admin                     |
| R2 como arquivo de log                            | Consulta e indexação piores                             |
| Log opcional via env (`AI_LOG_LLM`)               | Rejeitado — logging é obrigatório em todos os ambientes |
| Delete em cascade com `user`                      | Rejeitado — viola retenção indefinida                   |

## Decisão

### Princípio

Toda chamada LLM e toda operação R2 passa por **wrapper auditado**. Registros são **insert-only** na aplicação: **proibido `DELETE`** (e **proibido `UPDATE`** exceto completar status in-flight de LLM — ver abaixo).

Tabelas em D1 (detalhe de colunas: SPEC-0001):

| Tabela              | O quê                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| `llm_logs`          | Cada request/response a LLM (via AI SDK — ADR-0007)                             |
| `r2_operation_logs` | Cada `get`, `put`, `delete`, `head`, `list` em `FILES_BUCKET` e `MEMORY_BUCKET` |

`user_id` em ambas — **sem FK cascade** para `user` (logs sobrevivem à exclusão da conta; id permanece para auditoria).

### LLM (`src/lib/llm-logging.ts`)

- Hook em **todos** os entry points de `src/features/ai/` (`streamText`, `generateText`, `generateObject`, tool loops, jobs)
- Campos mínimos: `call_id` (unique), `call_type`, `provider`, `model`, `status`, `duration_ms`, tokens, `user_id`
- Falhas (`status=error`) **também** geram log
- Status `pending` → `success`|`error` permitido **uma vez** (completar chamada); demais colunas imutáveis após fechamento

### R2 (`src/lib/r2-audit.ts` + `src/functions/storage.ts`)

- **Proibido** chamar `bucket.get/put/delete/head/list` direto fora do wrapper
- Log **após** tentativa com: `bucket`, `operation`, `object_key`, `bytes` (quando aplicável), `status`, `duration_ms`, `error_message`, `user_id`
- Operações de leitura (`get`, `head`, `list`) e escrita (`put`, `delete`) — **todas** registradas

### UI / admin

- Listagem: `/admin/llm-logs` e `/admin/r2-logs` (SPEC-0015)
- Sem botão de exclusão; sem endpoint de purge

### Retenção

- **Indefinida** na aplicação v1
- `db:reset` local é ferramenta de dev — não é API de prod
- Política de arquivo em cold storage (futuro) exige ADR nova — não apaga silenciosamente

## Consequências

- Volume D1 cresce monotonicamente — índices por `(user_id, created_at)`
- Wrappers adicionam latência mínima (insert assíncrono `schedule*` aceitável; não bloquear stream)
- Testes mockam persistência — nunca desabilitam logging no código de produção
- **Proibido:** `DELETE`/`TRUNCATE` em `llm_logs` e `r2_operation_logs`; bypass do wrapper; flag global que desliga logging; cascade delete de logs com `user`

## Confirmação

```bash
test -f src/lib/llm-logging.ts && test -f src/lib/r2-audit.ts
! grep -rE '\.delete\(|DELETE FROM' src/db/queries/llm-logs.ts src/db/queries/r2-operation-logs.ts 2>/dev/null
grep -rq 'persistLlmLog\|scheduleLlmLog' src/features/ai/ 2>/dev/null
grep -rq 'auditR2\|logR2Operation' src/functions/storage.ts src/lib/r2-audit.ts 2>/dev/null
npm run typecheck
```

## Notas

Schema: SPEC-0001 (`llm_logs`, `r2_operation_logs`). UI admin: SPEC-0015. Integração AI: ADR-0007.

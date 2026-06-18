---
status: draft
date: 2026-06-18
builds-on: [ADR-0005, SPEC-0003, SPEC-0014]
implemented-by: []
---

# Admin: listagem de logs LLM e R2

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Append-only: ADR-0005.
> Schema: SPEC-0001 (`llm_logs`, `r2_operation_logs`). Shell admin: SPEC-0006.

## Objetivo

Administrador (`admin:access`) consulta logs de chamadas LLM e operações R2 em `/admin/llm-logs`
e `/admin/r2-logs` — somente leitura, sem exclusão nem purge (ADR-0005).

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Rotas admin, paginação, filtros, campos exibidos — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Filtros v1: usuário, provider, operação R2, intervalo de datas
- [ ] Detalhe expandível vs página dedicada por log
- [ ] Volume e paginação cursor vs offset

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run <escopo>        # N/N verdes
```

## Revisão humana

-

## Verificação

```text
(preencher no fechamento)
```

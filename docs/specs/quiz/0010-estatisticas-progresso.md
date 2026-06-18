---
status: draft
date: 2026-06-18
builds-on: [SPEC-0009]
implemented-by: []
---

# Estatísticas e progresso do quiz

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Tentativas: SPEC-0009.
> Schema: SPEC-0001 (`attempts`).

## Objetivo

Usuário autenticado visualiza desempenho agregado por exame e global — acertos, evolução e
questões mais erradas — a partir das tentativas registradas.

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Rotas, queries agregadas, formatos de métricas — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Escopo v1: por exame, global ou ambos
- [ ] Período de agregação (semana, mês, all-time)
- [ ] Rota dedicada vs seção no detalhe do exame

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

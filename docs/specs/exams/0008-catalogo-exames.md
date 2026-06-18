---
status: draft
date: 2026-06-18
builds-on: [SPEC-0001, SPEC-0004]
implemented-by: []
---

# Catálogo de exames: listagem e detalhe de provas

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Questões persistidas pelo ingest
> (SPEC-0004) alimentam este catálogo. Schema: SPEC-0001 (`exams`, `questions`).

## Objetivo

Usuário autenticado lista seus exames importados, abre detalhe com questões extraídas e navega
para quiz (SPEC-0009) ou explicações (SPEC-0011).

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Rotas, server functions, queries D1 — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Rotas v1: `/exams`, `/exams/$examId` — confirmar vs legado
- [ ] Edição/exclusão de exame e cascade (SPEC-0001)
- [ ] Filtros, busca e ordenação na listagem

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

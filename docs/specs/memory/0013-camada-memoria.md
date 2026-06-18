---
status: draft
date: 2026-06-18
builds-on: [ADR-0002, SPEC-0004]
implemented-by: []
---

# Camada de memória do usuário

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Storage R2 memory binding: ADR-0002.
> Schema: SPEC-0001 (`memory_profile`, `memory_sessions`, `memory_topic_notes`, `memory_documents`).
> Prefixo R2: `users/{userId}/memory/{kind}/{id}.md`.

## Objetivo

Sistema mantém perfil e notas de estudo por usuário, consultáveis pelo chat (SPEC-0012) e
outros fluxos de IA — sem vazar dados entre usuários.

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- CRUD de memória, sync D1 ↔ R2, tipos de documento — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Escopo v1: perfil + topic notes vs documentos completos
- [ ] Atualização automática pós-ingest ou pós-quiz
- [ ] UI de edição vs só consumo interno pela IA

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

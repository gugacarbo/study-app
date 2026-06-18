---
status: draft
date: 2026-06-18
builds-on: [ADR-0007]
implemented-by: []
---

# Spell check e web search como tools de IA

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Integração AI: ADR-0007.
> Providers: SPEC-0003.

## Objetivo

Agentes de IA expõem tools opcionais de correção ortográfica e busca web — configuráveis por
fluxo (chat, ingest, explicações) conforme necessidade v1.

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Definição das tools, schemas, limites e logging — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Quais fluxos v1 habilitam cada tool
- [ ] Provider de web search e rate limits
- [ ] Spell check: biblioteca local vs API externa

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

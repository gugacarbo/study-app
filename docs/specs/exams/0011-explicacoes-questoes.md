---
status: draft
date: 2026-06-18
builds-on: [ADR-0007, SPEC-0008]
implemented-by: []
---

# Explicações de questões via IA

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Provider/modelo: SPEC-0003.
> Questões: SPEC-0008. Campos `explanation` / `deep_explanation` fora do ingest (SPEC-0004).

## Objetivo

Usuário autenticado solicita explicação curta ou aprofundada de uma questão; resposta gerada
via Vercel AI SDK (ADR-0007) e persistida na questão.

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Server functions, streaming vs job, campos persistidos — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Job em background vs stream HTTP direto (ADR-0008)
- [ ] Regenerar explicação vs cache em D1
- [ ] Logging LLM (ADR-0005) e limites de custo

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

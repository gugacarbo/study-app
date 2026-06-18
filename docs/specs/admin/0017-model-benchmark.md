---
status: draft
date: 2026-06-18
builds-on: [ADR-0007, ADR-0009]
implemented-by: []
---

# Admin: benchmark de modelos via job em background

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Providers: SPEC-0003.
> Orquestração: ADR-0009. Stream/poll de progresso: ADR-0008. Shell admin: SPEC-0006.

## Objetivo

Administrador (`admin:access`) dispara job de benchmark comparando modelos/providers configurados;
progresso e resultados via mesmo padrão de jobs (SPEC-0014).

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Tipo de job, métricas, persistência de resultados — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Dataset/fixture de prompt padrão para benchmark
- [ ] Métricas: latência, tokens, qualidade subjetiva
- [ ] Rota admin e reutilização de UI de jobs (SPEC-0014)

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

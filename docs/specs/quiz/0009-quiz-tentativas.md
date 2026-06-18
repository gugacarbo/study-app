---
status: draft
date: 2026-06-18
builds-on: [SPEC-0008]
implemented-by: []
---

# Quiz: tentativas de resposta por exame

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Exame e questões: SPEC-0008.
> Schema: SPEC-0001 (`attempts`, `questions`).

## Objetivo

Usuário autenticado responde questões de um exame, registra tentativas em D1 e vê feedback
imediato — base para estatísticas (SPEC-0010).

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Rotas, server functions, formato de tentativa — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Modo de quiz: sequencial, aleatório, filtro por tópico
- [ ] Persistência parcial vs tentativa completa
- [ ] Relação `attempts` ↔ `questions` (SPEC-0001)

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

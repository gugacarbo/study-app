---
status: draft
date: 2026-06-18
builds-on: [ADR-0007, ADR-0008, ADR-0003]
implemented-by: []
---

# Chat multi-conversa assistido por IA

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Auth: ADR-0003. Providers: ADR-0007.
> Chat ao vivo usa stream HTTP direto — fora do modelo Queue (ADR-0008). Schema: SPEC-0001
> (`chat_conversations`).

## Objetivo

Usuário autenticado mantém múltiplas conversas com assistente de estudo; mensagens persistidas
e UI via assistant-ui com streaming em tempo real.

## Fluxo

<!-- Passo a passo do comportamento observável — a definir. -->

## Contrato

<!-- Rotas `/api/chat`, persistência R2/D1, formato de conversa — a definir. -->

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   |                  |                           |

## Questões em aberto

- [ ] Persistência: D1 metadata + R2 `users/{userId}/chats/{conversationId}.json` (SPEC-0001)
- [ ] Contexto injetado: exame, questão, memória (SPEC-0013)
- [ ] Limite de conversas e título automático

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

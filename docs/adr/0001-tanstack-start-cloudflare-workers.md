---
status: accepted
date: 2026-06-17
builds-on: []
deciders: []
---

# Usar TanStack Start em Cloudflare Workers

## Contexto e problema

App fullstack React com rotas tipadas, server functions e API streaming no mesmo deploy serverless. Precisa de bindings nativos D1/R2 sem serviço de banco separado.

## Direcionadores da decisão

- Um artefato de deploy (Worker) para páginas e API
- Type safety end-to-end (rotas, server functions, queries)
- Bindings Cloudflare sem hop intermediário
- DX local: `pnpm dev` e `pnpm wrangler:dev`

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| TanStack Start + Workers | **Escolhida** — bindings nativos, server functions, `nodejs_compat` |
| Next.js / Vercel | D1/R2 awkward; vendor lock-in |
| SPA + Worker separado | Dois deploys; streaming IA mais complexo |

## Decisão

**TanStack Start** com entry `@tanstack/react-start/server-entry`, `nodejs_compat`, build Vite + `@cloudflare/vite-plugin`.

- Rotas finas em `src/routes/` → delegação para `src/features/`
- Mutations: `createServerFn` + Zod
- Streaming: `createFileRoute` + `server.handlers`
- Árvore de rotas gerada em `src/routeTree.gen.ts`

## Consequências

- Deploy: `npm run deploy` (`wrangler.jsonc` é fonte de bindings)
- Após mudar bindings: `npm run cf-typegen`
- **Proibido:** editar `routeTree.gen.ts`; bibliotecas Node pesadas incompatíveis com Workers (ex.: `pdf-parse`)

## Confirmação

```bash
grep -q '@tanstack/react-start/server-entry' wrangler.jsonc
grep -q 'nodejs_compat' wrangler.jsonc
npm run typecheck
```

## Notas

Operação e bindings: `docs/context/INFRA.md`.

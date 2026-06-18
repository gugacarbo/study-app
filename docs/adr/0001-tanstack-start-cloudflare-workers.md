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
- Type safety end-to-end (rotas, functions, queries)
- Bindings Cloudflare sem hop intermediário
- DX local: `pnpm dev` e `pnpm wrangler:dev`

## Opções consideradas

| Opção                    | Veredito                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| TanStack Start + Workers | **Escolhida** — bindings nativos, server functions, `nodejs_compat` |
| Next.js / Vercel         | D1/R2 awkward; vendor lock-in                                       |
| SPA + Worker separado    | Dois deploys; streaming IA mais complexo                            |

## Decisão

**TanStack Start** com entry `@tanstack/react-start/server-entry`, `nodejs_compat`, build Vite + `@cloudflare/vite-plugin`.

### Rotas e domínio

| Camada        | Local                            | Regra                                                       |
| ------------- | -------------------------------- | ----------------------------------------------------------- |
| Rotas (finas) | `src/routes/{segment}/index.tsx` | Uma pasta por segmento de URL; delegam para `src/features/` |
| Features      | `src/features/{domain}/`         | UI, store, hooks de domínio                                 |
| Admin         | `src/routes/admin/`              | `/admin/*` — permissão `admin:access` (ADR-0004)            |
| API streaming | `src/routes/api/`                | Só HTTP fino — lógica em `src/features/ai/`                 |

Ex.: `/login` → `src/routes/login/index.tsx`; `/exams/$id` → `src/routes/exams/$id/index.tsx`. Detalhe → `docs/context/CONVENTIONS.md`.

- Mutations: `createServerFn` + Zod em `src/functions/`
- Streaming: rotas API delegam para `src/features/ai/`
- Árvore de rotas gerada em `src/routeTree.gen.ts`

### `src/functions/` (ex-`server-functions`)

Infra na raiz; domínios em subpastas:

```
src/functions/
  db.ts, storage.ts
  auth/          # requireSession, wrappers de sessão
  exams/, quiz/, memory/, ai/, chat/, admin/
```

### Componentes e hooks

| Tipo                     | Local                                                |
| ------------------------ | ---------------------------------------------------- |
| shadcn / primitivos      | `src/components/ui/`                                 |
| Composites cross-feature | `src/components/` (ex.: shells de quiz, exam-detail) |
| Hooks compartilhados     | `src/hooks/`                                         |
| Hooks de domínio         | `src/features/{domain}/hooks/`                       |

### Shell e devtools

- **Layout:** redesign no greenfield — não replicar shell do legado (nav + dock lateral)
- **Devtools:** TanStack Router/Query Devtools + Assistant DevTools no root **somente em `development`**

### Testes

Colocados ao lado do código: `*.test.ts` (lógica), `*.spec.tsx` (componentes). Sem espelho `tests/` global.

## Consequências

- Deploy: `npm run deploy` (`wrangler.jsonc` é fonte de bindings)
- Após mudar bindings: `npm run cf-typegen`
- Data loading: `useSuspenseQuery` + functions — não route loaders (exceto `beforeLoad`)
- **Proibido:** editar `routeTree.gen.ts`; rotas planas (`login.tsx`, `admin.foo.tsx`) — usar `{segment}/index.tsx`; `#/*` em código novo; bibliotecas Node pesadas incompatíveis com Workers (ex.: `pdf-parse`)

## Confirmação

```bash
grep -q '@tanstack/react-start/server-entry' wrangler.jsonc
grep -q 'nodejs_compat' wrangler.jsonc
test -d src/functions
npm run typecheck
```

## Notas

Operação e bindings: `docs/context/INFRA.md`. Convenções de layout: `docs/context/CONVENTIONS.md`.


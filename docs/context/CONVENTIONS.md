# Convenções — Study App

Estado atual. Imperativo. Para decisões datadas → `docs/adr/`.

## Stack

TanStack Start + Router + Query · React 19 · Cloudflare Workers · D1 + Drizzle · R2 · Biome v2 · Vitest · Tailwind v4 · shadcn/ui

## Layout

| Tipo                          | Local                    |
| ----------------------------- | ------------------------ |
| Rotas (finas)                 | `src/routes/`            |
| Domínio (UI + store + lógica) | `src/features/{domain}/` |
| Server functions              | `src/server-functions/`  |
| Schema + queries              | `src/db/`                |
| Infra compartilhada           | `src/lib/`               |
| UI primitiva                  | `src/components/ui/`     |

## Imports

1. Pacotes externos
2. `@/` para cross-directory (`tsconfig` + shadcn)
3. `./` para siblings

Não usar `#/*` em código novo (legado: `chat.tsx`). Testes podem usar `#/` ou `@/`.

## Naming

| Elemento                  | Padrão            |
| ------------------------- | ----------------- |
| Componentes / arquivos UI | PascalCase `.tsx` |
| Hooks, utils, server fns  | camelCase         |
| Diretórios                | kebab-case        |
| Constantes                | UPPER_SNAKE_CASE  |

## Server functions

- `createServerFn` + Zod via `inputValidator` (`src/lib/validation.ts`)
- Toda chamada de IA no servidor — nunca no browser
- D1 via `getDB()` em `src/server-functions/db.ts` — não importar de client

## Data loading

Rotas usam `useSuspenseQuery` + server functions — não route loaders (exceto `beforeLoad` pontual).

## Forms

`react-hook-form` + `@hookform/resolvers` + Zod. Não usar `@tanstack/react-form`.

## Erros

Server: throw com mensagem descritiva. Client: try/catch + UI amigável. Nunca engolir erro.

## Anti-patterns

- `any` → `unknown` + type guards
- Blobs grandes em D1 (limite ~1MB/row) → R2
- `index` como React `key` (usar `id`; `biome-ignore` só se inevitável)
- Editar `src/routeTree.gen.ts`
- Misturar agents de domínios diferentes
- Hover inline (`onMouseEnter`) → variantes shadcn Button

## Referência completa

`docs/codebase-patterns.md` — naming, styling, feature module tree, testes resumidos.

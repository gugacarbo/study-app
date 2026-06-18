# Convenções — Study App

Estado atual. Imperativo. Para decisões datadas → `docs/adr/`.

## Stack

TanStack Start + Router + Query · React 19 · Cloudflare Workers · D1 + Drizzle · R2 · Biome v2 · Vitest · Tailwind v4 · shadcn/ui · Better Auth · Vercel AI SDK · @assistant-ui/react

## Layout

| Tipo                          | Local                                              |
| ----------------------------- | -------------------------------------------------- |
| Rotas (finas)                 | `src/routes/` — uma pasta por segmento; ver abaixo |
| Admin (`/admin/*`)            | `src/routes/admin/`                                |
| Domínio (UI + store + lógica) | `src/features/{domain}/`                           |
| Server functions              | `src/functions/`                                   |
| Schema + queries              | `src/db/` (`queries/` modular por domínio)         |
| Infra compartilhada           | `src/lib/`                                         |
| Hooks compartilhados          | `src/hooks/`                                       |
| Hooks de domínio              | `src/features/{domain}/hooks/`                     |
| UI primitiva (shadcn)         | `src/components/ui/`                               |
| Composites cross-feature      | `src/components/`                                  |
| Streaming / agents IA         | `src/features/ai/` (rotas API delegam)             |

### `src/routes/` (file-based routing)

Cada rota vive em **pasta com o nome do segmento**; o arquivo da rota é **`index.tsx`** (ou `index.ts` só para API).

| URL             | Arquivo                             |
| --------------- | ----------------------------------- |
| `/`             | `src/routes/index.tsx`              |
| `/login`        | `src/routes/login/index.tsx`        |
| `/exams`        | `src/routes/exams/index.tsx`        |
| `/exams/$id`    | `src/routes/exams/$id/index.tsx`    |
| `/admin`        | `src/routes/admin/index.tsx`        |
| `/admin/config` | `src/routes/admin/config/index.tsx` |
| `/api/chat`     | `src/routes/api/chat/index.ts`      |

Regras:

- **Proibido** arquivo plano no lugar da pasta (`login.tsx`, `admin.config.tsx`) — legado em `.old_app/` não é modelo
- Raiz da árvore: `__root.tsx` (TanStack)
- Módulos privados da rota (schema, handlers): mesmo diretório, prefixo `-` — ex.: `api/chat/-schema.ts`
- Rotas permanecem finas: UI e lógica em `src/features/`; API pesada delega para `src/features/ai/` (ADR-0007)

### `src/functions/`

```
functions/
  db.ts, storage.ts
  auth/
  exams/, quiz/, memory/, ai/, chat/, admin/
```

## Imports

1. Pacotes externos
2. `@/` para cross-directory (`tsconfig` + shadcn)
3. `./` para siblings

Não usar `#/*`. Testes usam `@/` como o app.

## Naming

| Elemento                         | Padrão                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| Arquivos `.ts` / `.tsx`          | kebab-case — ex.: `use-ingest-job.ts`, `ingest-upload-form.tsx` |
| Export de componentes / hooks    | PascalCase / `use` + PascalCase — ex.: `IngestUploadForm`, `useIngestJob` |
| Diretórios                       | kebab-case — ex.: `background-processes/`                    |
| Constantes                       | UPPER_SNAKE_CASE                                             |
| PKs de domínio                   | UUID `text` (SPEC-0001)                                      |

Regras para `.ts` / `.tsx`:

- Nome do arquivo em kebab-case espelha o export principal (`ingest-upload-form.tsx` → `IngestUploadForm`)
- Hooks: prefixo `use-` no basename — `use-admin-users.ts` → `useAdminUsers`
- Testes ao lado do módulo: mesmo basename + sufixo — `ingest-upload-form.spec.tsx`
- **Exceções** (framework / gerados): `index.tsx` em rotas, `__root.tsx`, segmentos `$param`, módulos de rota com prefixo `-` (ex.: `-index.tsx`), `routeTree.gen.ts`

## Lint (Biome)

- **150 linhas** por arquivo (máximo) — `nursery/noExcessiveLinesPerFile` em `biome.json`, severidade `error`
- Arquivo grande → dividir em módulos menores (`features/`, `db/queries/`, helpers `-` na rota)
- Exclusões só via `files.includes` em `biome.json` (ex.: `src/routeTree.gen.ts`, `src/styles.css`) — não `biome-ignore` para contornar tamanho

## Server functions (`src/functions/`)

- `createServerFn` + Zod via `inputValidator` (`src/lib/validation.ts`)
- Toda chamada de IA no servidor — nunca no browser
- `getSession` / `requireSession` em `functions/auth/` — toda function de domínio exige sessão
- `/admin/*`: `requireAdminSession` — permissão `admin:access` via `src/lib/rbac.ts`; falha → **404** (ADR-0004)
- D1 via `getDB()` em `functions/db.ts` — não importar de client

## Navegação

- Rotas internas: `Link` de `@tanstack/react-router` com prop `to` — **nunca** `<a href="/...">` para paths do app
- Navegação programática: `useNavigate()` — **nunca** `window.location.href` / `assign` / `replace` para paths internos
- Redirect no servidor: `redirect()` em `beforeLoad` / `loader` (ex.: sessão em `/login`)
- Exceções: URLs externas (`target="_blank"`, `rel="noopener noreferrer"`), HTML de email (`auth-magic-link-email.ts`)

## Data loading

Rotas usam `useSuspenseQuery` + functions — não route loaders (exceto `beforeLoad` para auth).

## Forms

`react-hook-form` + `@hookform/resolvers` + Zod. Não usar `@tanstack/react-form`.

## Shell e devtools

Layout global em redesign (não copiar shell do `.old_app/`). TanStack Devtools + Assistant DevTools no root **apenas em `development`**.

## Testes

Colocados ao lado do código: `ingest-upload-form.spec.tsx`, `auth.test.ts`. Ver `docs/context/TESTS.md`.

## Erros

Server: throw com mensagem descritiva. Client: try/catch + UI amigável. Recurso de outro usuário → **404**. Nunca engolir erro.

## Anti-patterns

- `any` → `unknown` + type guards
- Blobs grandes em D1 (limite ~1MB/row) → R2
- `index` como React `key` (usar `id`; `biome-ignore` só se inevitável)
- Editar `src/routeTree.gen.ts`
- Rotas planas em `src/routes/` (`foo.tsx`, `admin.bar.tsx`) — usar `foo/index.tsx`, `admin/bar/index.tsx`
- Misturar agents de domínios diferentes
- Hover inline (`onMouseEnter`) → variantes shadcn Button
- Importar de `.old_app/` no código novo
- Classe `DBQueries` monolítica — usar módulos em `db/queries/`
- Stores de job em `src/stores/` — usar `features/background-processes/` (sync server-side, ADR-0009)
- Tratar fechar aba como cancel de job LLM — usar `POST /api/jobs/:id/cancel`
- LLM e R2: sempre via `lib/llm-logging.ts` e `lib/r2-audit.ts` — logs nunca deletados (ADR-0005)
- API keys em D1: sempre `encryptSecret` antes de persistir (ADR-0006)
- Upload ingest v1: só `.txt`/`.md` — rejeitar `.pdf` (ADR-0002)
- `<a href="/...">` ou `window.location` para rotas internas — usar `Link` / `useNavigate`
- Arquivos `.ts`/`.tsx` em camelCase ou PascalCase — usar kebab-case (exceto rotas/gerados)

# AGENTS.md

```yaml
casa-repo-id: study-app
casa-tier: T0
casa-standard-ref: 9d655cf
```

> Padrão: https://github.com/atplus-digital/casa-standard (STANDARD.md)
> ROUTER (CASA §4): carga sempre, teto ~150 linhas. Só alto-ROI transversal.
> Estourou o teto → conteúdo desce para docs/context/, fica o ponteiro.
> ⚠️ NÃO usar @import para colar capítulos: @import expande tudo no launch.
> Regras de um pacote específico → <subdir>/AGENTS.md (lazy nativo, nearest-wins).

## Contexto em 5 linhas

Web app multi-usuário para estudar provas universitárias: upload de PDFs, extração de questões via IA, quiz, estatísticas e chat assistido.
Stack: TanStack Start + Router + Query · React 19 · Cloudflare Workers · D1 + R2 · Drizzle · Vercel AI SDK · Better Auth · assistant-ui · shadcn/ui.
Reescrita greenfield — paridade v1, schema UUID + dados do zero. Legado local: `.old_app/` (gitignored).
Auth: Better Auth + magic link (ADR-0003). Config IA e admin em `/admin/*`. Decisões: `docs/adr/` · Specs: `docs/specs/` (globais na raiz; demais em subpastas por domínio — ver `docs/context/SPECS.md`).

## Infra & ambientes

Cloudflare Workers (prod + local via `wrangler dev`). Bindings: D1, R2 (files + memory). Detalhe → `docs/context/INFRA.md`.
NUNCA: Supabase CLI, `pdf-parse` em Workers, API keys no bundle client, import estático de `cloudflare:workers`, import de `.old_app/`.

## Como rodar localmente

> App em rebuild greenfield — `src/` e `vite.config.ts` ainda não existem na raiz.

```bash
pnpm install              # postinstall: cf-typegen
# pnpm dev                # após scaffold TanStack Start
```

## Como validar (DoD global do repo)

```bash
npm run typecheck         # exit 0
npm test                  # tudo verde
npm run docs-check        # exit 0 (gate CASA)
```

## Como deployar

```bash
npm run deploy            # vite build + wrangler deploy
npm run db:migrate:prod   # migrations D1 remoto (após schema estável)
```

Não rodar `db:reset:prod` sem confirmação explícita — destrutivo.

## Git & PRs

Remote: `origin` → GitHub (`gugacarbo/study-app`). Branch principal: `main`.
Commits e PRs só quando pedido. Cada spec fecha em commit atômico (`implemented` + `implemented-by` + `## Verificação`).

## Gotchas

- Legado em `.old_app/` — referência só; não portar glue custom (pipeline/reducers) sem spec
- Rotas: pasta por segmento + `index.tsx` — ex. `/login` → `src/routes/login/index.tsx` (não `login.tsx`)
- Server functions em `src/functions/` (não `server-functions/`); queries D1 modulares (não `DBQueries` mixin)
- PKs de domínio: UUID `text` (SPEC-0001)
- Hooks compartilhados → `src/hooks/`; hooks de domínio → `features/{domain}/hooks/`
- Streaming IA: lógica em `features/ai/`; rotas API delegam; UI padrão assistant-ui
- Devtools (TanStack + assistant) no root só em `development`
- Sessão: `getSession` / `requireSession` em functions; filtrar `user_id`; outro user → 404
- Auth: só `@aluno.ifsc.edu.br`; magic link via Resend (`noreply@gugacarbo.space`)
- Admin: `/admin/*` exige permissão `admin:access` em D1 (ADR-0004); `ADMIN_EMAILS` só no signup
- Ingest v1: upload `.txt`/`.md` apenas — PDF fora do escopo (ADR-0002)
- API keys: criptografar com `CONFIG_ENCRYPTION_KEY` (ADR-0006)
- Logs LLM + R2: append-only em D1 — nunca `DELETE`; wrappers obrigatórios (ADR-0005)
- Jobs longos: Queue + D1 (ADR-0009) — refresh não mata job; só upload exige browser aberto
- Blobs de prova (`files`): `ttl_seconds` em D1; **0 = sem expiração**; purge diário (SPEC-0002)

## Mapa de contexto

| Capítulo                      | Quando carregar                                     |
| ----------------------------- | --------------------------------------------------- |
| `docs/context/CONVENTIONS.md` | escrever/alterar Spec, endpoint ou function         |
| `docs/context/SPECS.md`       | criar spec, reservar número, escolher pasta/domínio |
| `docs/context/INFRA.md`       | migration, deploy, bindings Cloudflare              |
| `docs/context/TESTS.md`       | escrever ou alterar testes                          |

## Mapa de docs

- Decisões: `docs/adr/` · Comportamento: `docs/specs/` (README gerado; layout → `docs/context/SPECS.md`)
- Pendências e reservas de numeração: `docs/BACKLOG.md`
- Validar: `npm run docs-check` · Regenerar índices: `npm run docs-check:update`

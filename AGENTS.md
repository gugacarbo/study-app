# AGENTS.md

```yaml
casa-repo-id: study-app
casa-tier: T1
casa-standard-ref: 9d655cf
```

> Padrão: https://github.com/atplus-digital/casa-standard (STANDARD.md)
> ROUTER (CASA §4): carga sempre, teto ~150 linhas. Só alto-ROI transversal.
> Estourou o teto → conteúdo desce para docs/context/, fica o ponteiro.
> ⚠️ NÃO usar @import para colar capítulos: @import expande tudo no launch.
> Regras de um pacote específico → <subdir>/AGENTS.md (lazy nativo, nearest-wins).

## Contexto em 5 linhas

Web app multi-usuário para estudar provas universitárias: upload de PDFs, extração de questões via IA, quiz, estatísticas e chat assistido.
Stack: TanStack Start + Router + Query · React 19 · Cloudflare Workers · D1 + R2 · Drizzle · Vercel AI SDK · Better Auth · shadcn/ui.
Reescrita greenfield in-place guiada por specs CASA — paridade total v1, schema e dados do zero.
Auth: Better Auth + magic link (ADR-0004); dados isolados por `user_id`. Providers/modelos em `/admin/config`.
Decisões de stack: `docs/adr/` (0001–0006, accepted). Comportamento: `docs/specs/` (ver `docs/BACKLOG.md`).

## Infra & ambientes

Cloudflare Workers (prod + local via `wrangler dev`). Bindings: D1, R2 (files + memory). Detalhe → `docs/context/INFRA.md`.
NUNCA: Supabase CLI, `pdf-parse` em Workers, API keys no bundle client, import estático de `cloudflare:workers`.

## Como rodar localmente

> App em rebuild greenfield — `src/` e `vite.config.ts` ainda não existem na raiz. Referência legada: `.old_app/`.

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
Commits e PRs só quando pedido. Reescrever código in-place por domínio; cada spec fecha em commit atômico (`implemented` + `implemented-by` + `## Verificação`).

## Gotchas

- Código legado arquivado em `.old_app/` (gitignored) — só referência local; não importar no app novo
- Jobs longos de IA usam UI Message Stream — ver ADR-0005
- Sessão via Better Auth cookie — server functions devem chamar `getSession` e filtrar por `user_id` (ADR-0004)
- Auth: só `@ifsc.edu.br`; magic link via Resend (`noreply@gugacarbo.space`)

## Mapa de contexto

| Capítulo                      | Quando carregar                                    |
| ----------------------------- | -------------------------------------------------- |
| `docs/context/CONVENTIONS.md` | escrever/alterar Spec, endpoint ou server function |
| `docs/context/INFRA.md`       | migration, deploy, bindings Cloudflare             |
| `docs/context/TESTS.md`       | escrever ou alterar testes                         |

## Mapa de docs

- Decisões: `docs/adr/` · Comportamento: `docs/specs/` (READMEs GERADOS — não editar)
- Pendências e reservas de numeração: `docs/BACKLOG.md`
- Validar: `scripts/docs-check` · Regenerar índices: `scripts/docs-check --emit-index`

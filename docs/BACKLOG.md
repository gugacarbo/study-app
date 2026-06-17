# Backlog — Study App

Ledger de pendências e reservas de numeração CASA.

## Reescrita greenfield (v1)

| Fase                              | Status       | Notas                                                         |
| --------------------------------- | ------------ | ------------------------------------------------------------- |
| Fase 0 — Fundação CASA            | concluída    | router, BACKLOG, ADRs                                         |
| Fase 1 — ADRs de stack            | concluída    | ADR-0001 … 0006 `accepted`                                    |
| Fase 2 — Specs por domínio        | em andamento | SPEC-0000, 0001 accepted                                      |
| Fase 2b — Arquivo legado          | concluída    | `.old_app/` (gitignored) — `src`, `tests`, migrations antigas |
| Fase 3 — Implementação greenfield | em andamento | scaffold vazio; começar SPEC-0000 + SPEC-0001                 |
| Fase 4 — Cutover de dados         | pendente     | clean slate + `db:reset`                                      |

## ADRs (stack)

| ID       | Arquivo                                              | Status   |
| -------- | ---------------------------------------------------- | -------- |
| ADR-0001 | `docs/adr/0001-tanstack-start-cloudflare-workers.md` | accepted |
| ADR-0002 | `docs/adr/0002-d1-drizzle-r2-storage.md`             | accepted |
| ADR-0003 | `docs/adr/0003-vercel-ai-sdk-multi-provider.md`      | accepted |
| ADR-0004 | `docs/adr/0004-better-auth-multi-user-magic-link.md` | accepted |
| ADR-0005 | `docs/adr/0005-ui-message-stream-jobs.md`            | accepted |
| ADR-0006 | `docs/adr/0006-background-processes-cliente.md`      | accepted |

## Specs (ordem de implementação)

| ID        | Arquivo                                            | builds-on                     |
| --------- | -------------------------------------------------- | ----------------------------- |
| SPEC-0000 | `docs/specs/0000-autenticacao-magic-link.md`       | ADR-0004                      | accepted |
| SPEC-0001 | `docs/specs/0001-schema-migrations-clean-slate.md` | ADR-0002, ADR-0004            | accepted |
| SPEC-0002 | `docs/specs/0002-config-providers-modelos.md`      | ADR-0003, ADR-0004            |
| SPEC-0003 | `docs/specs/0003-upload-arquivos-r2.md`            | ADR-0002, ADR-0004            |
| SPEC-0004 | `docs/specs/0004-pipeline-ingestao.md`             | ADR-0003, ADR-0005, SPEC-0003 |
| SPEC-0005 | `docs/specs/0005-catalogo-exames.md`               | SPEC-0001, SPEC-0004          |
| SPEC-0006 | `docs/specs/0006-quiz-tentativas.md`               | SPEC-0005                     |
| SPEC-0007 | `docs/specs/0007-estatisticas-progresso.md`        | SPEC-0006                     |
| SPEC-0008 | `docs/specs/0008-explicacoes-questoes.md`          | ADR-0003, SPEC-0005           |
| SPEC-0009 | `docs/specs/0009-melhoria-questoes-batch.md`       | ADR-0003, SPEC-0005           |
| SPEC-0010 | `docs/specs/0010-chat-multi-conversa.md`           | ADR-0003, ADR-0005, ADR-0004  |
| SPEC-0011 | `docs/specs/0011-camada-memoria.md`                | ADR-0002, SPEC-0004           |
| SPEC-0012 | `docs/specs/0012-background-processes-ui.md`       | ADR-0006                      |
| SPEC-0013 | `docs/specs/0013-admin-logs.md`                    | SPEC-0002, SPEC-0012          |
| SPEC-0014 | `docs/specs/0014-spell-check-web-search.md`        | ADR-0003                      |
| SPEC-0015 | `docs/specs/0015-model-benchmark.md`               | ADR-0003, ADR-0006            |

## Pendências

- [ ] Implementar SPEC-0000 + SPEC-0001 (auth + schema)
- [ ] Implementar domínios conforme specs fecham (`implemented`)

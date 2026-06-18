# Backlog — Study App

Ledger de pendências e reservas de numeração CASA.

## Reescrita greenfield (v1)

| Fase                              | Status       | Notas                                                                 |
| --------------------------------- | ------------ | --------------------------------------------------------------------- |
| Fase 0 — Fundação CASA            | concluída    | router, BACKLOG, ADRs                                                 |
| Fase 1 — ADRs de stack            | concluída    | ADR-0001 … 0009 (9 decisões, ordem por dependência)                   |
| Fase 2 — Specs por domínio        | em andamento | SPEC-0000–0003 implemented; SPEC-0004 ingest implemented              |
| Fase 2b — Arquivo legado          | concluída    | `.old_app/` (gitignored)                                              |
| Fase 2c — Convenções greenfield   | concluída    | `functions/`, UUID, queries modulares, assistant-ui, testes colocados |
| Fase 3 — Implementação greenfield | em andamento | SPEC-0000–0004 implemented                                            |
| Fase 4 — Cutover de dados         | pendente     | clean slate + `db:reset`                                              |

## ADRs (stack — ordem primitiva → externa)

| ID       | Arquivo                                              | Camada       | Status   |
| -------- | ---------------------------------------------------- | ------------ | -------- |
| ADR-0001 | `docs/adr/0001-tanstack-start-cloudflare-workers.md` | Plataforma   | accepted |
| ADR-0002 | `docs/adr/0002-d1-drizzle-r2-storage.md`             | Persistência | accepted |
| ADR-0003 | `docs/adr/0003-better-auth-multi-user-magic-link.md` | Autenticação | accepted |
| ADR-0004 | `docs/adr/0004-rbac-roles-permissions-d1.md`         | Autorização  | accepted |
| ADR-0005 | `docs/adr/0005-audit-log-llm-r2-append-only.md`      | Auditoria    | accepted |
| ADR-0006 | `docs/adr/0006-config-encryption-web-crypto.md`      | Segurança    | accepted |
| ADR-0007 | `docs/adr/0007-vercel-ai-sdk-multi-provider.md`      | IA           | accepted |
| ADR-0008 | `docs/adr/0008-ui-message-stream-jobs.md`            | Protocolo UI | accepted |
| ADR-0009 | `docs/adr/0009-background-jobs-server-side.md`       | Orquestração | accepted |

## ADRs futuras (não bloqueiam v1)

| Tópico                     | Gatilho                       |
| -------------------------- | ----------------------------- |
| PDF ingest                 | Paridade com provas só em PDF |
| Retenção cold storage logs | Volume D1 crítico (ADR-0005)  |

## Specs (ordem de implementação)

Layout: specs globais em `docs/specs/`; demais em `docs/specs/{domínio}/`. Numeração global contígua — ver `docs/context/SPECS.md`.

| ID        | Arquivo                                             | builds-on                                          | status      |
| --------- | --------------------------------------------------- | -------------------------------------------------- | ----------- |
| SPEC-0000 | `docs/specs/auth/0000-autenticacao-magic-link.md`   | ADR-0003, ADR-0004                                 | implemented |
| SPEC-0001 | `docs/specs/0001-schema-migrations-clean-slate.md`  | ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0009   | implemented |
| SPEC-0002 | `docs/specs/storage/0002-upload-arquivos-r2.md`     | ADR-0002, ADR-0003, ADR-0005                       | implemented |
| SPEC-0003 | `docs/specs/admin/0003-config-providers-modelos.md` | ADR-0007, ADR-0003, ADR-0006, ADR-0004             | accepted    |
| SPEC-0004 | `docs/specs/exams/0004-pipeline-ingestao.md`        | ADR-0007, ADR-0008, ADR-0009, SPEC-0002, SPEC-0003 | implemented |
| SPEC-0005 | `docs/specs/ui/0005-shell-area-logada.md`           | ADR-0001, ADR-0003, ADR-0004, SPEC-0000           | accepted    |
| SPEC-0006 | `docs/specs/exams/0006-catalogo-exames.md`          | SPEC-0001, SPEC-0004                               |             |
| SPEC-0007 | `docs/specs/quiz/0007-quiz-tentativas.md`           | SPEC-0006                                          |             |
| SPEC-0008 | `docs/specs/quiz/0008-estatisticas-progresso.md`    | SPEC-0007                                          |             |
| SPEC-0009 | `docs/specs/exams/0009-explicacoes-questoes.md`     | ADR-0007, SPEC-0006                                |             |
| SPEC-0010 | `docs/specs/chat/0010-chat-multi-conversa.md`       | ADR-0007, ADR-0008, ADR-0003                       |             |
| SPEC-0011 | `docs/specs/memory/0011-camada-memoria.md`          | ADR-0002, SPEC-0004                                |             |
| SPEC-0012 | `docs/specs/ui/0012-background-processes-ui.md`     | ADR-0009                                           |             |
| SPEC-0013 | `docs/specs/admin/0013-admin-logs.md`               | ADR-0005, SPEC-0003, SPEC-0012                     |             |
| SPEC-0014 | `docs/specs/ai/0014-spell-check-web-search.md`      | ADR-0007                                           |             |
| SPEC-0015 | `docs/specs/admin/0015-model-benchmark.md`          | ADR-0007, ADR-0009                                 |             |

## Pendências

- [x] Implementar SPEC-0000 + SPEC-0001 + SPEC-0002 (auth + schema + storage)
- [ ] Implementar domínios conforme specs fecham (`implemented`)

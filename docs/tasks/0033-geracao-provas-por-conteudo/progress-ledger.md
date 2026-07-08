# Progress Ledger: geracao-provas-por-conteudo

> **Plan:** `0033-geracao-provas-por-conteudo`
> **Registry:** `docs/tasks/0033-geracao-provas-por-conteudo/super-plan.json`
> **Generated:** 2026-07-08T00:10:56Z
> **Regenerated on every `super-plan.json` write via the active `render-progress-ledger.sh` helper path**

## Summary

| Status | Count |
|--------|-------|
| pending | 0 |
| in_progress | 0 |
| ready_for_review | 0 |
| reviewing | 0 |
| needs_fix | 0 |
| blocked | 0 |
| completed | 7 |
| cancelled | 0 |
| **Total** | **7** |

## Agent Profiles

| Profile | Model | Agent |
|---------|-------|-------|
| general | gpt-5.4 | worker |
| deep | gpt-5.5 | worker |
| quick | gpt-5.4-mini | worker |

## Tasks

| Task ID | Title | Profile | Batch | Phase | Status | Dependencies |
|---------|-------|---------|-------|-------|--------|-------------|
| Task-A-001 | Definir contratos compartilhados do generate-exam e do parser canônico | deep | A | foundation | ✅ completed | — |
| Task-A-002 | Adicionar a superfície client do modo Gerar com IA em /exams/new | general | A | surface | ✅ completed | — |
| Task-B-001 | Implementar handlers server de criação e upload do generate-exam | general | B | core | ✅ completed | Task-A-001 |
| Task-B-002 | Implementar parsing por arquivo e persistência de artefatos canônicos | deep | B | core | ✅ completed | Task-A-001, Task-B-001 |
| Task-C-001 | Implementar o worker de geração da prova e integrar ao consumer | deep | C | core | ✅ completed | Task-B-001, Task-B-002 |
| Task-C-002 | Estender monitor e listagens para o novo kind generate-exam | general | C | surface | ✅ completed | Task-A-001, Task-B-001 |
| Task-D-001 | Fechar o fluxo com testes focados e integração final | general | D | final | ✅ completed | Task-A-002, Task-B-001, Task-B-002, Task-C-001, Task-C-002 |

## Timeline

| Timestamp | Task | Event | Try |
|-----------|------|-------|-----|
| 2026-07-07T22:40:20Z | Task-A-001 | ready_for_review | 1 |
| 2026-07-07T22:40:20Z | Task-A-001 | started | 1 |
| 2026-07-07T22:43:59Z | Task-A-001 | ready_for_review | 2 |
| 2026-07-07T22:44:13Z | Task-A-002 | ready_for_review | 1 |
| 2026-07-07T22:44:13Z | Task-A-002 | started | 1 |
| 2026-07-07T22:45:53Z | Task-A-001 | ready_for_review | 3 |
| 2026-07-07T22:48:40Z | Task-A-002 | ready_for_review | 2 |
| 2026-07-07T23:18:37Z | Task-B-001 | ready_for_review | 2 |
| 2026-07-07T23:25:34Z | Task-B-001 | ready_for_review | 3 |
| 2026-07-07T23:25:34Z | Task-B-001 | ready_for_review | 3 |
| 2026-07-07T23:25:49Z | Task-B-001 | completed | 1 |
| 2026-07-07T23:46:07Z | Task-B-002 | ready_for_review | 1 |
| 2026-07-07T23:49:22Z | Task-C-001 | started | None |
| 2026-07-07T23:49:55Z | Task-C-002 | started | None |
| 2026-07-07T23:52:59Z | Task-C-002 | ready_for_review | None |
| 2026-07-07T23:55:41Z | Task-C-001 | ready_for_review | None |
| 2026-07-08T00:00:46Z | Task-D-001 | started | None |
| 2026-07-08T00:00:52Z | Task-D-001 | started | None |
| 2026-07-08T00:10:18Z | Task-D-001 | ready_for_review | None |

## Requirements Coverage

| Requirement | Status | Covered By |
|-------------|--------|------------|
| REQ-001: Adicionar modo Gerar com IA em /exams/new | ⏳ pending | Task-A-002, Task-B-001 |
| REQ-002: Sugerir título editável sem sobrescrever edição manual | ⏳ pending | Task-A-002, Task-D-001 |
| REQ-003: Criar sempre um novo exame por generate-exam | ⏳ pending | Task-B-001 |
| REQ-004: Salvar mainContent e contextFiles originais em R2 e files | ⏳ pending | Task-B-001 |
| REQ-005: Executar um parser-agent por arquivo com JSON canônico rígido | ⏳ pending | Task-A-001, Task-B-002, Task-D-001 |
| REQ-006: Persistir artefatos parseados em R2 e referenciar em metadata | ⏳ pending | Task-A-001, Task-B-002 |
| REQ-007: Gerar apenas questões objetivas compatíveis com exams e quiz | ⏳ pending | Task-C-001, Task-C-002, Task-D-001 |
| REQ-008: Aplicar limites, deduplicação e falha por insuficiência de questões válidas | ⏳ pending | Task-B-001, Task-C-001, Task-D-001 |
| REQ-009: Reaproveitar monitor e listagens de jobs para o novo kind | ⏳ pending | Task-C-002, Task-D-001 |
| REQ-010: Fechar o fluxo com testes focados e docs-check | ⏳ pending | Task-D-001 |

# Features

**Generated:** 2026-06-10 · **Last updated:** 2026-06-10 · Domínios colocados em `src/features/{domain}/`.

Cada feature agrupa components, hooks e stores do mesmo domínio. Rotas em `src/routes/` são wrappers finos que importam daqui.

## Módulos

| Feature     | Path         | Responsabilidade                                               |
| ----------- | ------------ | -------------------------------------------------------------- |
| `ai`        | `ai/`        | Agents, tools, chat, streaming, providers → ver `ai/AGENTS.md` |
| `background-processes` | `background-processes/` | Fila unificada (ingest, improve-questions, explanation-generation), provider, nav indicator, persistência |
| `ingest`    | `ingest/`    | Upload PDF, UI de ingestão; jobs orquestrados via `background-processes` |
| `exams`     | `exams/`     | Lista, detalhe, stats, explicações; improve-questions consome `background-processes` |
| `quiz`      | `quiz/`      | Player de quiz, `quiz/store/` (localStorage por exam/topic)    |
| `memory`    | `memory/`    | Dashboard de visualização de memória                           |
| `dashboard` | `dashboard/` | Home / overview                                                |
| `config`    | `config/`    | Form de provider IA (react-hook-form + Zod)                    |
| `theme`     | `theme/`     | Theme provider, toggle, `use-theme`                            |

## Convenções

- Novo domínio → nova pasta com `components/`, opcional `store/` ou `hooks/`
- Não criar stores em `src/stores/` (deprecado)
- Lógica de API pesada pode viver em `src/routes/.../-*.ts` colada à rota (ingest pipeline)
- IA sempre via `src/features/ai/` + server functions — nunca OpenRouter no client

## Onde não duplicar

- UI primitiva → `src/components/ui/`
- Queries D1 → `src/db/queries/`
- Server mutations → `src/server-functions/`

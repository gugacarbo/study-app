# Task-B-001 Report — Implementar handlers server de criação e upload do generate-exam

## Status
DONE

## Escopo implementado
- `src/functions/jobs/create-generate-exam-job.ts` — handler de criação do job `generate-exam`.
- `src/functions/jobs/upload-generate-exam-context.ts` — handler de upload de `mainContent` + `contextFiles`.
- `src/routes/api/jobs/index.ts` — dispatcher de criação agora reconhece `kind: "generate-exam"`.
- `src/routes/api/jobs/$id/upload.ts` — roteia upload pelo kind do job.
- `src/functions/jobs/create-generate-exam-job.test.ts` — testes focados de criação.
- `src/functions/jobs/upload-generate-exam-context.test.ts` — testes focados de upload.
- `docs/tasks/0033-geracao-provas-por-conteudo/Task-B-001/log-task.sh` — script de lifecycle logging.

## Decisões tomadas
- Criação do exame com `source = "Gerada por IA"` e `name = title` enviado (conforme orientação do orchestrador).
- Bloqueio de múltiplos jobs `generate-exam` ativos por usuário (`active_job_conflict`), seguindo o padrão de conflito do ingest.
- Resolução de modelo via `resolveAiModelId`, com fallback para o modelo padrão configurado.
- `mainContent` é persistido em R2 como `conteudo-base.md` e também vira uma row em `files` com `ttl_seconds = 0`, para rastreabilidade e coerência com o padrão ingest.
- Cada `contextFile` vira row em `files` com `ttl_seconds = 0`.
- Limites aplicados: título 1..120, `questionCount` 1..20, dificuldade `easy|medium|hard`, notas ≤ 2000, até 5 arquivos `.txt`/`.md`, corpo bruto ≤ 1 MB, soma decodificada ≤ 100.000 caracteres.
- Compensação best-effort em R2 quando falha após `put`, seguindo o padrão do ingest.

## Verificação
- `pnpm exec biome check src/functions/jobs/create-generate-exam-job.ts src/functions/jobs/upload-generate-exam-context.ts src/routes/api/jobs/index.ts src/routes/api/jobs/$id/upload.ts` — passou.
- `pnpm exec vitest src/functions/jobs/create-generate-exam-job.test.ts src/functions/jobs/upload-generate-exam-context.test.ts` — 9/9 passaram.
- `pnpm exec vitest src/functions/jobs/create-ingest-job.test.ts src/functions/jobs/upload-ingest-file.test.ts src/functions/jobs/create-improve-questions-job.test.ts` — 16/16 passaram (ingest inalterado).
- `npm run typecheck` — apresenta erros pré-existentes no domínio quiz (`credit`/`AttemptResultQuestion`), nenhum novo no escopo implementado.
- `npm run docs-check` — passou (0 erros, 0 avisos).

## Fixes após review
- `src/routes/api/jobs/index.ts`: body schema validado com Zod e `JOB_KIND` usado no dispatcher, rejeitando kinds desconhecidos com 400.
- `src/routes/api/jobs/$id/upload.ts`: job inexistente retorna 404; kinds não suportados retornam 400 em vez de cair no ingest.
- `src/functions/jobs/upload-generate-exam-context.ts`: em caso de falha após `put` em R2, o job é marcado como `FAILED` com `JOB_ERROR_CODE.UPLOAD_FAILED` após a compensação best-effort.
- `src/functions/jobs/upload-generate-exam-context.ts`: `mimeType` inferido como `text/markdown` para arquivos `.md`.

## Concerns
- `src/functions/jobs/upload-generate-exam-context.ts` continua com ~250 linhas, acima do warn do Biome (`maxLines: 200`) e acima da recomendação de 150 linhas do projeto. A função agrupa validação, R2/files e lifecycle em um único handler; a extração de helpers pode ser feita em refatoração posterior sem ampliar o write set atual.

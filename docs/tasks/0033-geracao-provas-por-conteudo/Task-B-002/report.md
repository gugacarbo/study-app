# Task-B-002 Report — Pipeline de parsing por arquivo e artefatos canônicos

## Status
DONE

## Escopo implementado
- `src/features/ai/jobs/generate-exam/read-context.ts` — leitura do `mainContent` e `contextFiles` do R2, com validação de existência e conteúdo.
- `src/features/ai/jobs/generate-exam/parse-context-file.ts` — runner de parser-agent por arquivo com schema Zod rígido, retry em erros transientes e logging LLM.
- `src/features/ai/jobs/generate-exam/store-parsed-artifact.ts` — persistência do JSON canônico derivado em R2 com audit logging.
- `src/features/ai/jobs/generate-exam/build-generation-context.ts` — consolidação de `mainContent` + artefatos parseados para o gerador de questões.
- `src/features/ai/jobs/generate-exam/read-context.test.ts` — 4 testes
- `src/features/ai/jobs/generate-exam/parse-context-file.test.ts` — 4 testes
- `src/features/ai/jobs/generate-exam/store-parsed-artifact.test.ts` — 3 testes
- `src/features/ai/jobs/generate-exam/build-generation-context.test.ts` — 3 testes

## Decisões tomadas
- `read-context.ts`: usa `files` table + join com `exams` para buscar arquivos do exame; identifica `conteudo-base.md` pelo nome; retorna `JobErrorBody` terminal em caso de falha.
- `parse-context-file.ts`: usa `generateObject` do Vercel AI SDK com `zodSchema`; até 2 retries com backoff 500ms/1500ms para erros transientes (429, 5xx, timeout); logging LLM completo (start/complete) com `createLlmLogCallId`.
- `store-parsed-artifact.ts`: persiste como `application/json` em R2; usa `auditedR2Put` para rastreabilidade; gera `artifactFileId` via `createId()`.
- `build-generation-context.ts`: valida `questionCount` (1..20) e `difficulty` (easy/medium/hard); retorna `GenerateExamGenerationContext` com `mainContent` bruto + documentos parseados.

## Verificação
- `pnpm exec vitest run src/features/ai/jobs/generate-exam/*.test.ts` — 14/14 passaram.
- `pnpm exec biome check src/features/ai/jobs/generate-exam/` — passou.

## Concerns
Nenhum. Os 4 módulos estão coesos, testados e prontos para integração no worker (Task-C-001).

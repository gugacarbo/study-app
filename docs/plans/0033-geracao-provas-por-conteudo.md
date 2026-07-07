# Geração de provas por conteúdo — Plano de implementação

> **For agentic workers:** Use subagent-driven development to implement this plan task-by-task.
> The executable source of truth is `docs/tasks/0033-geracao-provas-por-conteudo/super-plan.json`.

**Goal:** Adicionar em `/exams/new` um modo de geração de prova por IA que cria sempre um novo exame a partir de `mainContent` + `contextFiles`, salva os arquivos originais em R2, executa um parser-agent por arquivo de contexto para produzir JSON canônico persistido em R2 e então gera apenas questões objetivas compatíveis com o domínio atual de `exams` e `quiz`.

**Architecture:** O fluxo reaproveita a infraestrutura existente de jobs em duas etapas assíncronas dentro do mesmo worker: primeiro upload e persistência do contexto bruto (`mainContent` + arquivos), depois parsing por arquivo e geração das questões. O contrato novo fica concentrado em um novo `JOB_KIND.GENERATE_EXAM`, um diretório dedicado em `src/features/ai/jobs/generate-exam/` e um schema Zod canônico para os artefatos de parsing, que passam a ser insumos estruturados para o agente gerador da prova.

**Tech Stack:** React 19, TanStack Start + Router + Query, TypeScript, Zod, Drizzle ORM, Cloudflare Workers, D1, R2, Vercel AI SDK, Vitest.

## Global Constraints

- `title`: obrigatório; `trim`; `1..120` chars; começa com sugestão editável
- `mainContent`: obrigatório; `trim`; min `1` char
- `questionCount`: obrigatório; inteiro; `1..20`
- `difficulty`: obrigatório; `easy` \| `medium` \| `hard`
- `difficultyNotes`: opcional; `trim`; máx. `2000` chars
- `contextFiles[]`: opcional; até `5` arquivos `.txt`/`.md`
- Request body bruto do upload: até `1 MB`
- Soma do texto decodificado de `mainContent` + arquivos: até `100_000` caracteres
- Cada arquivo de contexto deve usar a mesma política de extensão permitida do ingest atual (`.txt`, `.md`)
- `mainContent` é salvo em R2 como arquivo sintético `conteudo-base.md`
- Cada arquivo enviado vira uma row em `files` com `ttl_seconds = 0`
- Os artefatos parseados não substituem o arquivo original; ambos coexistem
- Existe exatamente um output canônico por arquivo válido
- O output do parser precisa passar em schema Zod rígido antes de ser aceito
- Se o parser de um arquivo falhar, o job inteiro falha
- O output aceito do parser é persistido em R2 como artefato `.json` versionável
- O parser não produz markdown, apenas JSON válido
- O gerador da prova consome `mainContent` bruto, os JSONs canônicos dos arquivos parseados e os metadados do job
- Cada questão gerada deve seguir o mesmo formato objetivo da ingestão
- Apenas questões objetivas são permitidas nesta v1
- `explanation` e `deep_explanation` começam como `null`
- O prompt pede **exatamente** `questionCount` questões no nível de dificuldade escolhido
- Duplicatas usam a mesma normalização de enunciado do ingest
- Se, após validação e deduplicação, houver menos de `questionCount` questões válidas, o worker tenta regenerar até `2` vezes
- Se ainda assim ficar abaixo do total pedido, o job falha com persistência zero e erro de quantidade insuficiente
- Persistência das questões acontece apenas em batch final, nunca incremental

## File Structure

| File/Directory | Owner Task | Notes |
| --- | --- | --- |
| `src/routes/_app/exams/new/index.tsx` | Task-A-002 | Página passa a oferecer os modos `Importar arquivo` e `Gerar com IA` |
| `src/features/exams/components/generate-exam-form.tsx` | Task-A-002 | Novo formulário com título sugerido, conteúdo-base, dificuldade e anexos |
| `src/features/exams/components/generate-exam-form.spec.tsx` | Task-D-001 | Cobertura do formulário, sugestão de título e validações do modo novo |
| `src/features/exams/hooks/use-generate-exam-job.ts` | Task-A-002 | Hook client para criar job, enviar multipart e navegar ao monitor |
| `src/features/exams/lib/generate-exam-api.ts` | Task-A-002 | Cliente HTTP para `POST /api/jobs` e `POST /api/jobs/:id/upload` do novo kind |
| `src/routes/api/jobs/index.ts` | Task-B-001 | Dispatch entre `ingest`, `improve-questions` e `generate-exam` |
| `src/routes/api/jobs/$id/upload.ts` | Task-B-001 | Encaminhamento do upload para o handler apropriado por `job.kind` |
| `src/functions/jobs/create-generate-exam-job.ts` | Task-B-001 | Schema e criação do novo job com `exams.source = "Gerada por IA"` |
| `src/functions/jobs/upload-generate-exam-context.ts` | Task-B-001 | Upload multipart de `mainContent` + `contextFiles`, gravação em R2 e rows em `files` |
| `src/functions/jobs/create-generate-exam-job.test.ts` | Task-D-001 | Testes do contrato de criação do job |
| `src/functions/jobs/upload-generate-exam-context.test.ts` | Task-D-001 | Testes do contrato de upload, limites e erros |
| `src/lib/job-kinds.ts` | Task-A-001 | Novo `JOB_KIND`, metadata e vocabulário de fases do generate-exam |
| `src/lib/job-errors.ts` | Task-A-001, Task-B-001 | Novos códigos para parsing inválido, contexto insuficiente e falha de geração |
| `src/lib/file-validation.ts` | Task-B-001 | Reaproveitar regras atuais para os anexos do generate-exam |
| `src/features/ai/jobs/generate-exam/parser-schema.ts` | Task-A-001 | Schema Zod canônico do JSON produzido por cada parser-agent |
| `src/features/ai/jobs/generate-exam/types.ts` | Task-A-001 | Tipos compartilhados do worker, metadata e artefatos do pipeline |
| `src/features/ai/jobs/generate-exam/read-context.ts` | Task-B-002 | Leitura do `mainContent` e dos arquivos de contexto salvos em R2 |
| `src/features/ai/jobs/generate-exam/parse-context-file.ts` | Task-B-002 | Runner de parser-agent para um arquivo com validação do JSON canônico |
| `src/features/ai/jobs/generate-exam/store-parsed-artifact.ts` | Task-B-002 | Persistência em R2 do `.json` derivado por arquivo |
| `src/features/ai/jobs/generate-exam/build-generation-context.ts` | Task-B-002 | Consolidação de `mainContent` + artefatos parseados para a geração |
| `src/features/ai/jobs/generate-exam/generate-questions.ts` | Task-C-001 | Chamada estruturada ao modelo para gerar questões objetivas |
| `src/features/ai/jobs/generate-exam/run-generate-exam.ts` | Task-C-001 | Orquestrador do job: leitura, parsing, geração, retries e persistência |
| `src/features/ai/jobs/run-job-consumer.ts` | Task-C-001 | Novo case do consumer para `JOB_KIND.GENERATE_EXAM` |
| `src/features/ai/jobs/generate-exam/*.test.ts` | Task-D-001 | Cobertura dos schemas, parsing, orquestração e geração |
| `src/functions/jobs/list-user-jobs.ts` | Task-C-002 | Mapeamento do novo tipo para listagem e monitor |
| `src/functions/jobs/list-active-jobs.ts` | Task-C-002 | Inclusão do novo tipo nas consultas/DTOs de jobs ativos |
| `src/features/background-processes/lib/ingest-event-mapper.ts` | Task-C-002 | Decidir reutilização ou extração de mapper específico para eventos do generate-exam |
| `src/features/background-processes/lib/ingest-event-labels.ts` | Task-C-002 | Labels para `parsing_context_files` e geração da prova |
| `src/features/background-processes/pages/job-monitor-page.spec.tsx` | Task-C-002, Task-D-001 | Monitor precisa exibir estados e CTA do novo kind |

## Execution Batches

### Batch A — Foundation

#### Task-A-001 — Contratos compartilhados do generate-exam

- **Phase:** `foundation`
- **Profile:** `deep`
- **Goal:** Definir o novo vocabulário de job, metadata, fases e schema Zod canônico do parser por arquivo.
- **Deliverables:**
  - `JOB_KIND.GENERATE_EXAM`
  - metadata do generate-exam em `src/lib/job-kinds.ts`
  - novos códigos de erro em `src/lib/job-errors.ts`
  - schema Zod e tipos compartilhados em `src/features/ai/jobs/generate-exam/`
- **Notes:** Esta task não implementa worker nem rotas; apenas funda os contratos para as demais tarefas.

#### Task-A-002 — Superfície client para iniciar a geração

- **Phase:** `surface`
- **Profile:** `general`
- **Goal:** Adicionar o modo `Gerar com IA` em `/exams/new` com formulário, sugestão de título, cliente HTTP e hook próprios.
- **Deliverables:**
  - UI com alternância entre modos
  - formulário com `title`, `mainContent`, `questionCount`, `difficulty`, `difficultyNotes` e `contextFiles[]`
  - lógica client para criar o job, enviar multipart e navegar ao monitor
- **Notes:** Esta task depende apenas dos contratos de API definidos em plan/spec, não da implementação completa do worker.

### Batch B — API and Context Parsing

#### Task-B-001 — Handlers server de criação/upload do generate-exam

- **Phase:** `core`
- **Profile:** `general`
- **Goal:** Implementar a criação do job e o upload do contexto bruto com persistência em R2 + `files`.
- **Deliverables:**
  - `create-generate-exam-job.ts`
  - `upload-generate-exam-context.ts`
  - dispatch adequado nas rotas `/api/jobs` e `/api/jobs/$id/upload`
  - testes de validação e persistência do upload
- **Dependencies:** `Task-A-001`
- **Notes:** Deve preservar o padrão atual de ownership, `awaiting_upload -> queued` e compensação best-effort ao falhar após gravar em R2.

#### Task-B-002 — Pipeline de parsing por arquivo e artefatos canônicos

- **Phase:** `core`
- **Profile:** `deep`
- **Goal:** Implementar leitura dos arquivos de contexto em R2, execução de um parser-agent por arquivo, validação do JSON canônico e persistência dos artefatos derivados em R2.
- **Deliverables:**
  - leitura do `mainContent` sintético e dos anexos reais
  - runner por arquivo com schema rígido
  - persistência do `.json` derivado e referências em metadata
  - construtor do contexto estruturado a ser entregue ao gerador de questões
- **Dependencies:** `Task-A-001`, `Task-B-001`
- **Notes:** A falha de parsing de um único arquivo deve abortar o job completo antes da fase de geração.

### Batch C — Generation Worker and Job Monitoring

#### Task-C-001 — Worker de geração da prova

- **Phase:** `core`
- **Profile:** `deep`
- **Goal:** Implementar o orquestrador do novo job dentro do consumer, usando `mainContent` + artefatos parseados para gerar questões objetivas, deduplicar, aplicar retries e persistir em batch.
- **Deliverables:**
  - `run-generate-exam.ts`
  - integração com `run-job-consumer.ts`
  - geração estruturada das questões
  - retry por insuficiência de questões válidas
  - persistência final em `questions`
- **Dependencies:** `Task-B-001`, `Task-B-002`
- **Notes:** Reutilizar o máximo possível de `persistQuestions`, normalização e padrões já existentes no ingest.

#### Task-C-002 — Monitoramento e observabilidade do novo kind

- **Phase:** `surface`
- **Profile:** `general`
- **Goal:** Fazer o monitor e listagens de jobs entenderem `generate-exam`, incluindo labels das novas fases e o CTA de navegação da prova gerada.
- **Deliverables:**
  - novo mapeamento do kind em listagens
  - labels para `reading_context`, `parsing_context_files`, `generating_questions` e `persisting`
  - cobertura do monitor para estados do novo fluxo
- **Dependencies:** `Task-A-001`, `Task-B-001`
- **Notes:** Não redesenhar o monitor; apenas estender o comportamento atual.

### Batch D — Verification and Integration

#### Task-D-001 — Testes de integração e fechamento do fluxo

- **Phase:** `final`
- **Profile:** `general`
- **Goal:** Consolidar a cobertura do fluxo end-to-end em testes focados de client, server e worker e garantir que a nova feature passa pelo gate de docs.
- **Deliverables:**
  - suites focadas do formulário, criação de job, upload, parsing e worker
  - ajustes finais de contratos de tipos/DTOs
  - evidência para `docs-check`
- **Dependencies:** `Task-A-002`, `Task-B-001`, `Task-B-002`, `Task-C-001`, `Task-C-002`
- **Notes:** Esta task fecha o fluxo; não introduz comportamento novo além do necessário para estabilizar a feature.

## Structured Registry

- **Registry:** `docs/tasks/0033-geracao-provas-por-conteudo/super-plan.json`
- **Progress ledger:** `docs/tasks/0033-geracao-provas-por-conteudo/progress-ledger.md` (created in Phase 4 and regenerated on every `super-plan.json` write)
- **Task directories:** `docs/tasks/0033-geracao-provas-por-conteudo/<task-id>/` (materialized in Phase 6)
- **Task-local logs:** `docs/tasks/0033-geracao-provas-por-conteudo/<task-id>/progress.log` (materialized in Phase 6)
- **Task-local logger:** `docs/tasks/0033-geracao-provas-por-conteudo/<task-id>/log-task.sh` (materialized in Phase 6)

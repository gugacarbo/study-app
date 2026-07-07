---
status: draft
date: 2026-07-07
builds-on: [ADR-0002, ADR-0005, ADR-0008, ADR-0009, SPEC-0001, SPEC-0004, SPEC-0008, SPEC-0009]
implemented-by: []
---

# Geração de provas por conteúdo

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Usuário autenticado cria uma **nova prova** a partir de um conteúdo-base
informado manualmente, definindo título editável, quantidade de questões,
dificuldade (`fácil`, `médio`, `difícil`), instruções complementares e arquivos
`.txt`/`.md` opcionais como contexto adicional.

O resultado final é uma prova normal do catálogo, com questões **objetivas**
compatíveis com detalhe da prova, edição de questão, melhoria e quiz já
existentes.

Cada arquivo de contexto anexado também passa por uma etapa própria de parsing
por agente, produzindo um artefato JSON padronizado e persistido em R2 para uso
posterior no pipeline de geração.

## Fluxo

1. Usuário acessa `/exams/new` e escolhe o modo **"Gerar com IA"** ao lado do
   fluxo atual de importação.
2. A tela exibe formulário com:
   - `title`
   - `mainContent`
   - `questionCount`
   - `difficulty`
   - `difficultyNotes`
   - `contextFiles[]`
3. `title` começa vazio e é sugerido automaticamente quando houver conteúdo
   suficiente:
   - primeira heading markdown de `mainContent`;
   - senão, primeira linha não vazia de `mainContent`;
   - senão, nome do primeiro arquivo anexado sem extensão;
   - fallback final: `"Nova prova"`.
4. Após o usuário editar `title`, novas mudanças automáticas no conteúdo **não**
   sobrescrevem o valor digitado.
5. Ao enviar o formulário:
   - client chama `POST /api/jobs` com `kind: "generate-exam"` e os campos não
     binários;
   - servidor valida sessão e modelo, cria `exams` com `source = "Gerada por IA"`
     e cria `background_jobs` com `status = awaiting_upload`;
   - client envia `mainContent` e `contextFiles[]` no upload do job.
6. Servidor valida o upload, persiste o conteúdo-base e os arquivos de contexto
   em R2 + `files`, marca o job como `queued` e publica para a queue.
7. Consumer processa apenas jobs `queued` e:
   - lê `mainContent` salvo em R2;
   - para cada item de `contextFiles[]`, executa um parser-agent dedicado;
   - valida o output canônico do parser;
   - salva em R2 um artefato `.json` derivado por arquivo;
   - consolida `mainContent` + artefatos parseados como contexto estruturado da
     geração.
8. Após a etapa de parsing, o worker solicita ao modelo a geração das questões
   objetivas e só persiste quando houver um conjunto válido para a prova.
9. Job concluído leva o usuário ao monitor normal em `/jobs/$jobId`, com os
   mesmos estados, histórico e CTA de navegação já usados em ingest.
10. Quando o job termina com sucesso, o botão **"Ver prova"** abre o detalhe da
   prova gerada; o quiz dessa prova funciona normalmente porque todas as
   questões seguem o contrato objetivo atual.

## Fora de escopo

- Questões discursivas.
- Preview editável antes de persistir.
- Append de questões geradas em prova existente.
- Novo tipo de quiz ou mudanças no fluxo de resposta.

## Contrato

### Rotas e UI

| URL | Arquivo | Comportamento |
| --- | ------- | ------------- |
| `/exams/new` | `src/routes/_app/exams/new/index.tsx` | exibe dois modos: `Importar arquivo` e `Gerar com IA` |
| `/jobs/$jobId` | existente | reaproveita monitor de jobs atual |
| `/exams/$examId` | existente | mostra a prova gerada como prova normal |

O modo **Gerar com IA** usa formulário dedicado em `src/features/exams/`.

Campos do formulário:

| Campo | Tipo | Regra |
| ----- | ---- | ----- |
| `title` | `string` | obrigatório; `trim`; `1..120` chars; começa com sugestão editável |
| `mainContent` | `string` | obrigatório; `trim`; min `1` char |
| `questionCount` | `number` | obrigatório; inteiro; `1..20` |
| `difficulty` | enum | obrigatório; `easy` \| `medium` \| `hard` |
| `difficultyNotes` | `string` | opcional; `trim`; máx. `2000` chars |
| `contextFiles[]` | `File[]` | opcional; até `5` arquivos `.txt`/`.md` |

Labels visíveis ao usuário:

| Valor persistido | Label UI |
| ---------------- | -------- |
| `easy` | `Fácil` |
| `medium` | `Médio` |
| `hard` | `Difícil` |

### Criação do job (`POST /api/jobs`)

Body:

```ts
{
  kind: "generate-exam";
  title: string;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard";
  difficultyNotes?: string;
}
```

Resposta:

```ts
{ jobId: string; examId: string }
```

Regras:

- cria sempre um novo `exam`;
- `exams.name = title`;
- `exams.source = "Gerada por IA"`;
- resolve `modelId` com o mesmo fluxo padrão já usado por jobs de IA;
- cria job com `status = awaiting_upload`;
- não existe modo append nesta spec.

### Upload do contexto (`POST /api/jobs/:id/upload`)

Multipart fields:

| Campo | Regra |
| ----- | ----- |
| `mainContent` | obrigatório |
| `contextFiles` | zero ou mais arquivos `.txt`/`.md` |

Validações:

- request body bruto: até `1 MB`;
- soma do texto decodificado de `mainContent` + arquivos: até `100_000`
  caracteres;
- cada arquivo deve passar pela mesma política de extensão permitida do ingest
  atual (`.txt`, `.md`);
- arquivo vazio ou só whitespace é rejeitado;
- job precisa ser do usuário, `kind = "generate-exam"` e `status = awaiting_upload`.

Persistência do contexto:

- `mainContent` é salvo em R2 como arquivo sintético `conteudo-base.md`;
- cada arquivo enviado vira uma row em `files` com `ttl_seconds = 0`;
- o exam retém esses arquivos como trilha de auditoria e reprocessamento.
- os artefatos parseados não substituem o arquivo original; ambos coexistem.

### `background_jobs.metadata`

```ts
type GenerateExamJobMetadata = {
  examId: string;
  modelId: string;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard";
  difficultyNotes?: string;
  fileIds?: string[];
  parsedContextArtifactIds?: string[];
  parsedContextCount?: number;
  extractedCount?: number;
  persistedCount?: number;
  skippedDuplicateCount?: number;
  invalidCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
};
```

### `background_jobs.phase`

| Valor | Significado |
| ----- | ----------- |
| `reading_context` | lendo e consolidando `mainContent` + arquivos |
| `parsing_context_files` | executando parser-agent por arquivo e validando os JSONs canônicos |
| `generating_questions` | chamada ao modelo em andamento |
| `persisting` | persistindo questões válidas em batch |

### Parsing por arquivo de contexto

Cada `contextFile` gera uma execução independente de parser-agent. O job
orquestrador pode rodar esses parsers em paralelo, mas o contrato funcional é:

- existe exatamente um output canônico por arquivo válido;
- o output precisa passar em schema Zod rígido antes de ser aceito;
- se o parser de um arquivo falhar, o job inteiro falha;
- o arquivo original em R2 nunca é descartado por falha de parsing;
- o output aceito é persistido em R2 como artefato `.json` versionável.

O gerador da prova consome:

- `mainContent` bruto;
- os JSONs canônicos dos arquivos parseados;
- metadados do job (`questionCount`, `difficulty`, `difficultyNotes`).

### Output canônico do parser de arquivo

Cada parser-agent deve retornar um único JSON com este formato:

```ts
type ParserConfidence = "high" | "medium" | "low";

type ParserDocumentType =
  | "notes"
  | "syllabus"
  | "handout"
  | "exercise-list"
  | "exam-reference"
  | "mixed";

type SourceSpan = {
  sectionLabel: string | null;
  excerpt: string;
};

type ParsedSection = {
  id: string;
  title: string;
  level: number;
  summary: string;
  topicRefs: string[];
  keyPoints: string[];
  sourceSpan: SourceSpan;
  confidence: ParserConfidence;
};

type ParsedTopic = {
  id: string;
  name: string;
  summary: string;
  keywords: string[];
  sectionRefs: string[];
  sourceSpans: SourceSpan[];
  confidence: ParserConfidence;
};

type ParsedFact = {
  statement: string;
  importance: "high" | "medium" | "low";
  topicRefs: string[];
  sourceSpan: SourceSpan;
  confidence: ParserConfidence;
};

type ParsedStudyObjective = {
  description: string;
  topicRefs: string[];
  sourceSpan: SourceSpan;
  confidence: ParserConfidence;
};

type ParsedGlossaryEntry = {
  term: string;
  definition: string;
  topicRefs: string[];
  sourceSpan: SourceSpan;
  confidence: ParserConfidence;
};

type ParsedContextDocument = {
  schemaVersion: "1";
  sourceFileId: string;
  title: string;
  documentType: ParserDocumentType;
  summary: string;
  rawText: string;
  sections: ParsedSection[];
  topics: ParsedTopic[];
  facts: ParsedFact[];
  studyObjectives: ParsedStudyObjective[];
  glossary: ParsedGlossaryEntry[];
  warnings: string[];
};
```

Regras do schema:

- `rawText` existe apenas no nível do documento;
- `sections` são rasas, não recursivas;
- `topicRefs` e `sectionRefs` devem apontar para `id`s existentes no mesmo
  documento;
- `sourceSpan.excerpt` deve ser curto e fiel ao arquivo original;
- `warnings` lista ambiguidades, lacunas ou trechos ruidosos identificados pelo
  parser;
- o parser não inventa campos fora do schema;
- o parser não produz markdown, apenas JSON válido.

### Persistência dos artefatos parseados

Para cada `contextFile` aceito:

- o arquivo original continua em `files`;
- o JSON canônico vira um novo objeto R2;
- o job guarda referência a esse artefato em
  `metadata.parsedContextArtifactIds`;
- a convenção de nome do objeto derivado deve permitir relacionar facilmente o
  parse ao arquivo de origem.

### Contrato das questões geradas

Cada questão gerada deve seguir o mesmo formato objetivo da ingestão:

```ts
{
  question: string;
  options: Array<{ key: string; text: string }>;
  answers: string[];
  topic: string;
}
```

Regras adicionais:

- apenas questões objetivas;
- pelo menos `2` alternativas por questão;
- `answers` precisa referenciar `options[].key`;
- `scoring_mode` deriva do total de respostas corretas:
  - `1` resposta → `exact`
  - `>1` respostas → `partial`
- `explanation` e `deep_explanation` começam como `null`;
- `topic` segue o catálogo textual atual e pode depois ser normalizado pelos
  fluxos já existentes.

### Garantias da geração

- o prompt pede **exatamente** `questionCount` questões no nível de dificuldade
  escolhido;
- o contexto final é composto por `mainContent` primeiro e pelos artefatos
  parseados dos `contextFiles[]` na ordem de upload;
- duplicatas são detectadas pela mesma normalização de enunciado usada no
  ingest;
- overflow de questões válidas é truncado para as primeiras `questionCount`
  válidas e únicas;
- se, após validação e deduplicação, houver menos de `questionCount` questões
  válidas, o worker tenta regenerar até `2` vezes;
- se ainda assim ficar abaixo do total pedido, o job falha com persistência
  zero e erro de quantidade insuficiente;
- persistência acontece apenas em batch final, nunca incremental.

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1 | o usuário trocar de modo em `/exams/new` | preservar apenas o estado do modo ativo e não misturar campos de importação com geração |
| 2 | `title` ainda estiver vazio quando surgir conteúdo suficiente | preencher a sugestão automaticamente |
| 3 | o usuário já tiver editado `title` manualmente | não sobrescrever o valor com novas sugestões automáticas |
| 4 | `mainContent` estiver vazio | bloquear submissão |
| 5 | `questionCount` estiver fora de `1..20` | rejeitar com erro de validação `400` |
| 6 | algum arquivo de contexto tiver extensão inválida | rejeitar o upload inteiro com erro de tipo de arquivo |
| 7 | a soma do contexto ultrapassar `100_000` caracteres | rejeitar o upload com erro de tamanho |
| 8 | o parser-agent de um `contextFile` devolver JSON inválido | marcar o job como `failed` e não iniciar a geração das questões |
| 9 | o parser-agent de um arquivo falhar depois que o original já foi salvo em R2 | preservar o original e marcar o job como `failed` |
| 10 | o modelo devolver menos questões válidas do que o solicitado após os retries | marcar o job como `failed` e não persistir questão parcial |
| 11 | o modelo devolver mais questões válidas do que o solicitado | persistir apenas as primeiras `questionCount` válidas e únicas |
| 12 | duas questões geradas tiverem o mesmo enunciado normalizado | deduplicar antes de persistir |
| 13 | o usuário acessar uma prova gerada no quiz | incluir normalmente todas as questões objetivas geradas |
| 14 | o job falhar antes da persistência | manter o exame criado, sem questões, para inspeção ou remoção posterior |

## Questões em aberto

Nenhuma no momento.

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/features/exams/components/generate-exam-form.spec.tsx src/functions/jobs/create-generate-exam-job.test.ts src/features/ai/jobs/generate-exam src/features/ai/jobs/parse-context-files
npm run docs-check
```

## Revisão humana

- Validar se os níveis `Fácil`, `Médio` e `Difícil` produzem a calibragem
  pedagógica esperada para o domínio.
- Revisar a UX da sugestão automática de título antes do primeiro submit.
- Revisar se o schema canônico dos arquivos parseados está cobrindo bem os tipos
  reais de material de estudo usados pelos usuários.

## Verificação

```text
(preencher no fechamento)
```

---
status: draft
date: 2026-06-25
builds-on: [SPEC-0001, SPEC-0004, SPEC-0007, SPEC-0021]
implemented-by: []
---

# Catálogo global de tópicos para questões e resolução via tools de agente

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Trocar o campo textual livre `questions.topic` por uma referência explícita a uma
tabela global de tópicos de questões. O sistema passa a ter uma source of truth
única para nomes de tópicos, reutilizável entre provas diferentes, enquanto os
agentes de ingestão e revisão passam a resolver tópicos por tools dedicadas de
busca por similaridade e criação.

Com isso:

1. tópicos deixam de ser strings soltas por questão;
2. o catálogo global evita duplicatas quase idênticas;
3. ingest, revisão, edição manual e quiz passam a consumir o mesmo tópico
   canônico;
4. a v1 permanece textual e determinística, sem embeddings.

## Fluxo

### Ingestão

1. O agente de ingestão continua extraindo uma classificação textual provisória
   para cada questão.
2. Antes de concluir a questão, o agente chama `search_similar_topics` com esse
   texto.
3. A tool retorna zero ou mais candidatos do catálogo global, ordenados por
   similaridade textual.
4. O agente decide entre:
   - reutilizar um `topicId` existente dentre os candidatos;
   - chamar `create_topic` para criar um novo tópico canônico.
5. A questão bufferizada no job passa a carregar `topicId` e não mais um nome de
   tópico final como fonte de verdade.
6. Na persistência, o sistema salva `questions.topic_id`; o nome exibível do
   tópico passa a vir por join com `question_topics`.

### Revisão do ingest

1. O agente de revisão recebe a lista de drafts com `topicId` atual e, quando
   necessário, o nome do tópico resolvido para leitura.
2. Se o revisor entender que o assunto deve mudar, ele resolve o novo tópico pelo
   mesmo par de tools:
   - `search_similar_topics`;
   - `create_topic`.
3. O draft revisado atualiza apenas a referência `topicId` escolhida para a
   questão.

### Edição manual

1. Na edição manual de uma questão, o usuário deixa de gravar texto livre em
   `topic`.
2. O formulário passa a permitir buscar tópicos existentes e selecionar um
   candidato do catálogo global.
3. Quando o usuário quiser um novo tópico, o client chama a mesma action/função
   de criação usada pelo fluxo server-side e recebe o `topicId` criado.
4. A gravação final da questão persiste apenas `topic_id`.

### Quiz e leitura

1. As telas que hoje exibem `question.topic` passam a resolver o nome via join
   com `question_topics`.
2. Filtros de quiz continuam sendo apresentados como nomes legíveis, mas a
   filtragem interna passa a usar `topic_id`.
3. Questões sem `topic_id` continuam sendo exibidas como `Geral`.

### Migração

1. Criar `question_topics`.
2. Adicionar `questions.topic_id` nullable.
3. Popular `question_topics` com os valores distintos já existentes em
   `questions.topic`, deduplicados por nome normalizado.
4. Atualizar `questions.topic_id` para apontar ao tópico correspondente.
5. Migrar leituras e escritas do app para `topic_id`.
6. Remover `questions.topic` somente depois que todas as leituras, filtros,
   agents e formulários consumirem a nova referência.

## Contrato

### Persistência

Nova tabela global:

```ts
type QuestionTopic = {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string | null;
};
```

Regras:

- `name`: nome canônico exibido no app; obrigatório; trim; máximo 200 chars.
- `normalizedName`: derivado de `name`; obrigatório; usado para deduplicação e
  similaridade textual; índice único.
- o catálogo é global do sistema, sem escopo por usuário ou por prova.

Mudança em `questions`:

- remover dependência funcional de `questions.topic`;
- adicionar `questions.topic_id` com FK para `question_topics.id`;
- `topic_id` pode ser `null` na v1.

### Normalização textual

Função de normalização de tópico na v1:

1. `trim`;
2. colapsar whitespace consecutivo;
3. `toLowerCase()`.

A comparação por similaridade textual pode usar essa forma normalizada mais
heurísticas simples de prefixo, inclusão e distância textual, mas não usa
embeddings nesta spec.

### Tools dos agentes

Os agentes que resolvem assunto de questão passam a usar as tools abaixo:

| Tool | Função |
| --- | --- |
| `search_similar_topics` | Buscar tópicos globais candidatos a partir de um texto de entrada. |
| `create_topic` | Criar um novo tópico global quando não houver candidato adequado. |

Contrato mínimo:

```ts
type SearchSimilarTopicsInput = {
  query: string; // 1..200
  limit?: number; // default 5, max 10
};

type SearchSimilarTopicsResult = {
  ok: true;
  topics: Array<{
    topicId: string;
    name: string;
    normalizedName: string;
    similarityLabel: "exact" | "normalized_exact" | "prefix" | "partial";
  }>;
};

type CreateTopicInput = {
  name: string; // 1..200
};

type CreateTopicResult =
  | {
      ok: true;
      topic: {
        topicId: string;
        name: string;
        normalizedName: string;
      };
      created: boolean;
    }
  | {
      ok: false;
      reason: "invalid_name";
    };
```

Regras:

- `search_similar_topics` pode retornar lista vazia.
- `search_similar_topics` não cria nem altera dados.
- `create_topic` deduplica por `normalizedName`.
- se o nome normalizado já existir, `create_topic` retorna `ok: true` com o
  tópico existente e `created: false`.
- o agente escolhe explicitamente entre reutilizar um candidato ou criar um novo
  tópico; a tool de busca não faz auto-link.

### Agentes afetados

Esta spec altera o contrato dos agentes que manipulam tópicos de questões:

- agente de ingestão;
- agente de revisão do ingest;
- agente de melhoria de questão, quando puder editar tópico.

Eles podem continuar raciocinando sobre um texto provisório de assunto, mas o
estado persistível da questão deve carregar `topicId` como referência final.

### Leitura e filtros

- `QuestionDetail`, `ExamDetail` e tipos derivados devem expor o tópico resolvido
  a partir do join com `question_topics`.
- O quiz deve listar tópicos por prova consultando o catálogo relacionado às
  questões daquele exame, e não mais por `select distinct questions.topic`.
- O filtro de quiz deve persistir e consultar por `topic_id`; a UI continua
  exibindo o nome canônico.

### Edição manual

- O formulário de edição de questão deixa de aceitar texto livre como
  persistência final do tópico.
- O campo de tópico vira um seletor/busca com criação explícita.
- A criação manual de tópico deve reutilizar a mesma regra de deduplicação de
  `create_topic`.

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | --- | --- |
| 1 | `search_similar_topics` não encontra candidatos | retornar lista vazia e permitir que o agente chame `create_topic` |
| 2 | `create_topic` recebe nome vazio ou só whitespace | rejeitar com erro de validação e não criar registro |
| 3 | `create_topic` recebe um nome cujo `normalizedName` já existe | retornar o tópico existente com `created: false`, sem duplicar |
| 4 | duas execuções tentam criar o mesmo tópico ao mesmo tempo | garantir unicidade por índice em `normalized_name` e retornar o tópico canônico vencedor |
| 5 | uma questão ainda não tem `topic_id` após migração parcial ou edição antiga | exibir `Geral` nas UIs e não quebrar quiz/detalhe |
| 6 | o agente decide trocar o tópico de uma questão revisada | exigir nova resolução via tools; não aceitar string final livre no estado persistível |
| 7 | a prova possui questões com nomes antigos distintos que colapsam para o mesmo normalizado | apontar ambas para o mesmo tópico canônico na migração |
| 8 | o usuário abre uma edição manual enquanto o catálogo cresce | buscar candidatos atuais em tempo real e salvar só o `topic_id` escolhido/criado |
| 9 | um filtro de quiz referenciar um tópico que não existe mais entre as questões do exame | tratar como filtro inválido e impedir início da tentativa |

## Questões em aberto

Nenhuma no escopo desta v1. Embeddings, aliases e governança editorial de
tópicos ficam fora desta spec.

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/features/ai/jobs/ingest
npm test -- --run src/functions/exams
npm test -- --run src/functions/quiz
npm test -- --run src/db/queries
npm run docs-check
```

## Revisão humana

- Confirmar se o catálogo global gera nomes canônicos aceitáveis para provas de
  disciplinas diferentes.
- Validar a ergonomia do campo de tópico na edição manual: busca, seleção e
  criação sem confundir o usuário.
- Revisar se `Geral` continua sendo o fallback desejado quando uma questão ficar
  sem tópico.

## Verificação

```text
Spec em draft; verificação de implementação será preenchida no fechamento.
```

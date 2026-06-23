---
status: implemented
date: 2026-06-22
builds-on: [ADR-0008, SPEC-0019, SPEC-0020]
implemented-by:
  - src/features/background-processes/lib/group-ingest-events.ts
  - src/features/background-processes/lib/group-ingest-events.test.ts
  - src/features/background-processes/components/ingest-events-grouped-list.tsx
  - src/features/background-processes/components/ingest-events-list.spec.tsx
---

# Upload job: agrupar mensagens de sistema como blocos de chat expansíveis

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo

Melhorar a leitura da visualização de upload/job para que mensagens de sistema
como `Arquivo lido: 69 caracteres` deixem de aparecer como badges/cartões
técnicos soltos e passem a seguir o mesmo padrão mental do chat: um bloco de
mensagem resumido pela atualização mais recente, com histórico expansível.

## Fluxo

1. A tab de eventos continua agrupada por fase de ingest.
2. Dentro de cada fase, eventos consecutivos classificados como `system` formam
   um grupo sequencial inline.
3. O primeiro evento do grupo abre um bloco expandido automaticamente.
4. Enquanto novos eventos consecutivos do mesmo tipo chegam, eles entram no
   mesmo bloco sem recolher a UI.
5. Quando a sequência é interrompida por um evento que não pertence ao grupo, o
   bloco deixa de ser ativo.
6. Blocos não ativos ficam recolhidos por padrão e mostram apenas a última
   mensagem da sequência.
7. Ao expandir um bloco recolhido, a UI revela todas as mensagens daquele grupo
   em ordem cronológica.

## Contrato

### Escopo

- Componente alvo: `src/features/background-processes/components/ingest-events-grouped-list.tsx`
- Agrupador alvo: `src/features/background-processes/lib/group-ingest-events.ts`
- A mudança vale para a visualização de eventos do job de upload; não altera o
  contrato de persistência dos eventos nem a classificação `system` já usada no
  mapper atual.

### Regra de agrupamento inline

Entrada: eventos já ordenados por `seq` ascendente dentro de uma fase.

Saída: lista heterogênea de itens renderizáveis:

- `event`: evento individual não agrupado
- `system-group`: sequência de eventos consecutivos classificados como sistema

Regras:

1. Ao encontrar um evento de sistema sem grupo ativo, criar um novo
   `system-group`.
2. Enquanto os eventos seguintes também forem de sistema, anexá-los ao grupo
   ativo.
3. Ao encontrar um evento não-sistema, encerrar o grupo ativo e emitir esse
   evento como item individual.
4. Se um novo evento de sistema aparecer após a interrupção, criar outro grupo.
5. O grupo preserva todos os eventos originais; não pode haver deduplicação que
   esconda mensagens intermediárias.

### Estado de expansão

Cada `system-group` possui dois estados visuais:

- `active`: grupo ainda recebendo eventos consecutivos de sistema
- `closed-history`: grupo encerrado por interrupção da sequência

Comportamento:

- grupo `active` inicia expandido por padrão
- grupo `active` permanece expandido enquanto novas mensagens entram nele
- grupo `closed-history` fica colapsado por padrão
- interação manual do usuário para expandir/recolher continua disponível após o
  grupo ser encerrado

### Trigger colapsado

Quando o grupo estiver recolhido, o cabeçalho do bloco DEVE mostrar:

- a última mensagem textual do grupo como resumo principal
- um contador discreto de quantas atualizações o grupo contém
- affordance visual de expandir/recolher

O trigger colapsado NÃO DEVE mostrar:

- `seq`
- timestamp bruto
- badge técnica de tipo
- card colorido por categoria de sistema

### Conteúdo expandido

Quando o grupo estiver expandido, a UI DEVE mostrar:

- a lista completa das mensagens do grupo em ordem cronológica
- detalhes estruturados de cada evento abaixo da respectiva mensagem, em
  tipografia secundária
- tratamento visual de mensagem de chat/sistema, não de log técnico

### Direção visual

O bloco de `system-group` DEVE:

- se parecer com uma mensagem do chat, com fundo suave e borda discreta
- usar um ícone neutro de sistema/status
- evitar cores fortes por subtipo como `file-read`, `llm-call` ou
  `persist-validating`

O bloco de `system-group` NÃO DEVE:

- reutilizar o visual atual de badge cinza/cartão técnico por item
- competir visualmente com reasoning, tool calls ou mensagens assistant

## Casos de borda

| # | QUANDO | o sistema DEVE |
| --- | --- | --- |
| 1 | existir apenas uma mensagem de sistema isolada na fase | renderizar um `system-group` com um único item, expandido enquanto ativo e recolhido após a sequência encerrar |
| 2 | duas sequências de sistema forem separadas por um evento não-sistema | renderizar dois grupos distintos, cada um com seu próprio estado |
| 3 | o usuário expandir manualmente um grupo histórico | preservar a expansão daquele grupo até nova interação do usuário ou rerender normal da tela |
| 4 | um grupo ativo receber novas mensagens durante o poll/SSE | anexar as mensagens ao grupo atual sem recolher o bloco |
| 5 | existir detalhes estruturados em parte das mensagens do grupo | exibir detalhes só nessas mensagens, sem criar linhas vazias nas demais |
| 6 | houver mistura de mensagens de sistema textuais e system-info na mesma sequência | manter ambas no mesmo grupo, desde que continuem consecutivas e classificadas como sistema |

## Questões em aberto

Nenhuma.

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run src/features/background-processes
```

## Revisão humana

- Conferir se o bloco de sistema realmente “lê como chat” e não como painel
  administrativo.
- Conferir se o resumo colapsado prioriza bem a última mensagem em mobile.

## Verificação

```text
- npm run typecheck: passou
- npm test -- --run src/features/background-processes: 106 passaram
- docs-check: passou após renumerar spec de SPEC-0021 para SPEC-0022
- implementado-by: src/features/background-processes/lib/group-ingest-events.ts, src/features/background-processes/components/ingest-events-grouped-list.tsx
```

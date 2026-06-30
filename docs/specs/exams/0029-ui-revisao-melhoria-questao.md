---
status: draft
date: 2026-06-29
builds-on: [SPEC-0024, SPEC-0025, SPEC-0027, SPEC-0028]
implemented-by: []
---

# UI de revisão de melhoria na página da questão

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não repete essas regras; só define
> a reorganização visual e comportamental da revisão de melhoria pendente.

## Objetivo

Reduzir a sensação de tela espalhada em `/exams/$examId/questions/$questionId`
quando existir `melhoria pendente`, transformando a lateral no centro de
decisão e o conteúdo principal em uma revisão objetiva das mudanças propostas.

Esta spec não altera contratos de dados, mutações, rotas nem regras de negócio
de aprovação/descartar. O foco é UI/UX do fluxo já existente.

## Fluxo

1. O usuário abre a página dedicada de uma questão com draft pendente.
2. A tela mantém a navegação superior da prova e o contexto da questão.
3. A coluna lateral assume o papel principal de decisão:
   - `Aprovar melhoria`;
   - `Descartar melhoria`;
   - `Editar pergunta` como alternativa secundária.
4. O conteúdo principal deixa de mostrar snapshots completos como fluxo padrão
   e passa a exibir um diff orientado por campos.
5. O usuário revisa apenas os campos que mudaram e decide aprovar, descartar ou
   editar manualmente.

## Contrato

### Hierarquia visual

Quando houver draft pendente, a página DEVE seguir esta ordem de prioridade:

1. navegação e contexto curto da questão;
2. decisão na lateral;
3. evidências da mudança no conteúdo principal;
4. edição manual como rota alternativa.

O conteúdo principal NÃO DEVE competir com a lateral por protagonismo de ação.

### Lateral decisória

Com draft pendente, a lateral DEVE ser dividida em dois blocos visuais:

1. `Decisão sobre a melhoria`;
2. `Edição manual`.

O bloco de decisão DEVE:

- exibir o status `Melhoria pendente`;
- mostrar um resumo curto da proposta, quando existir;
- destacar `Aprovar melhoria` como ação principal;
- manter `Descartar melhoria` como ação claramente visível;
- comunicar que a revisão da proposta é o fluxo preferencial da tela.

O bloco de edição manual DEVE:

- renderizar `Editar pergunta` abaixo do bloco de decisão;
- ter menos peso visual que aprovar/descartar;
- deixar claro que editar é um caminho alternativo caso a proposta não sirva.

### Edição manual

Ao entrar em edição manual:

- o formulário continua aparecendo na lateral;
- o bloco de decisão permanece visível acima do formulário;
- a revisão da questão no conteúdo principal continua acessível;
- a tela NÃO deve substituir a decisão pela edição como foco principal.

### Conteúdo principal com diff por campos

Quando houver draft pendente, o conteúdo principal DEVE trocar o comparativo
primário `Original` vs `Melhorada` por uma revisão orientada por campos.

Cada seção DEVE aparecer apenas se houver mudança real no campo correspondente.

As seções possíveis são:

- `Enunciado`;
- `Alternativas`;
- `Resposta correta`;
- `Explicação`;
- `Explicação detalhada`;
- `Metadados` (`tópico` e `modo de correção`), somente se mudarem.

### Apresentação das diferenças

Cada seção de diff DEVE:

- usar rótulos claros como `Antes` e `Depois`;
- favorecer leitura objetiva do que mudou;
- tratar mudanças curtas inline quando fizer sentido;
- tratar conteúdos longos em blocos separados para leitura confortável.

Para `Alternativas`, a UI DEVE evidenciar quais itens mudaram, foram
reordenados ou deixaram de ser corretos, sem exigir comparação mental entre dois
cartões completos.

### Snapshots completos

Snapshots completos `Original` e `Melhorada` PODEM continuar existindo como
apoio secundário, mas NÃO devem ser a visualização principal do fluxo.

Se forem mantidos, devem ficar atrás de uma ação discreta como `Ver snapshot
completo`.

### Repetição de CTAs

Com draft pendente, a tela NÃO DEVE repetir `Aprovar melhoria` e `Descartar
melhoria` como CTAs de mesmo peso no conteúdo principal e na lateral.

O ponto principal de decisão DEVE ser a lateral.

## Casos de borda

| #   | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | ---------------- | ------------------------- |
| 1   | a questão tem draft pendente com poucas mudanças | mostrar apenas as seções realmente alteradas, sem blocos vazios |
| 2   | a questão tem mudanças longas em enunciado ou explicações | separar `Antes` e `Depois` em blocos confortáveis para leitura |
| 3   | só tópico ou modo de correção mudaram | exibir apenas a seção de `Metadados` |
| 4   | o usuário inicia edição manual com draft pendente | manter o bloco de decisão visível e o conteúdo principal acessível |
| 5   | não existe draft pendente | a página volta ao comportamento definido por `SPEC-0027`, sem diff de revisão |
| 6   | os snapshots completos forem expandidos | isso não pode deslocar o foco principal da decisão na lateral |

## Questões em aberto

Sem questões em aberto no escopo desta spec.

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/features/exams
npm run docs-check
```

## Revisão humana

- Clareza da lateral como centro de decisão.
- Legibilidade do diff por campos em desktop e mobile.
- Peso visual correto de `Editar pergunta` como alternativa secundária.

## Verificação

```text
(preencher no fechamento)
```

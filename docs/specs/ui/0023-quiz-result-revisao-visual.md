---
status: draft
date: 2026-06-24
builds-on: [SPEC-0007, SPEC-0008, SPEC-0021]
implemented-by: []
---

# Quiz: resultado final com revisão visual orientada a estudo

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não repete contratos de tentativas,
> pontuação ou persistência já definidos em SPEC-0007; ela refina a apresentação
> visual da tela final e da revisão das respostas.

## Objetivo

Transformar a tela final do quiz em um fechamento de sessão de estudo mais claro,
memorável e útil para revisão rápida. O usuário deve perceber seu desempenho em
segundos, entender com facilidade o que acertou ou errou, e revisar resposta do
usuário, gabarito e explicação sem depender de leitura densa ou de cards
visualmente genéricos.

## Fluxo

1. Ao abrir `/exams/$examId/quiz/$attemptId/result`, o topo da página apresenta
   um hero de sessão com score, faixa de desempenho e uma leitura humana curta
   do resultado.
2. Abaixo do hero, a página mostra métricas resumidas em blocos com hierarquia
   desigual: acertos como dado principal, respondidas como consistência da
   sessão, total como referência de escopo.
3. A revisão por questão aparece em coluna única, com status claro e leitura
   rápida de:
   - enunciado;
   - alternativas destacando acerto, erro e escolha do usuário;
   - resposta correta;
   - resposta do usuário;
   - explicação, quando existir.
4. O CTA de nova tentativa permanece presente, mas subordinado à revisão e ao
   resumo de desempenho.
5. Em mobile, o hero e as métricas empilham sem perder contraste, e cada bloco
   de revisão mantém separação suficiente entre status, alternativas e
   explicação.

## Contrato

### Escopo visual

Esta spec altera apenas apresentação, hierarquia de informação e microcopy da
rota de resultado do quiz:

| Área | Componentes-alvo |
| --- | --- |
| página de resultado | `src/features/quiz/pages/quiz-result-page.tsx` |
| hero e métricas | `src/features/quiz/components/quiz-result-summary.tsx` |
| revisão por questão | `src/features/quiz/components/quiz-answer-review.tsx` |

Não altera:

- cálculo de score;
- shape de `AttemptResult`;
- regras de acerto, erro ou crédito parcial;
- rotas do quiz;
- persistência de respostas.

### Direção visual congelada

O redesign DEVE seguir uma linguagem de "boletim de sessão de estudo", com
equilíbrio entre sensação de progresso e clareza de revisão.

#### Paleta

| Papel | Hex | Uso |
| --- | --- | --- |
| papel | `#F7F4EE` | fundo geral ou superfícies amplas |
| superfície | `#FFFDF8` | cards e blocos internos |
| tinta | `#1F2328` | títulos, score, texto principal |
| carvão suave | `#5B6470` | meta-informação e texto secundário |
| âmbar de progresso | `#C67A2B` | destaque do hero e microdetalhes de progresso |
| verde de acerto | `#2F7D61` | acertos e estados positivos |
| vermelho de revisão | `#B44D3A` | erros e atenção de revisão |

As cores de acerto e erro DEVEM ser mais sóbrias que um padrão dashboard
convencional; a página não deve parecer nem gamificada nem administrativa.

#### Tipografia e tom

- score e títulos com peso forte e tracking mais fechado;
- labels de apoio em caixa alta discreta ou equivalente visual de utilitário;
- texto de revisão e explicação com leitura calma, sem excesso de contraste;
- microcopy curta, direta e orientada a estudo.

#### Estrutura

- hero superior com presença visual maior que a lista de revisão;
- métricas em blocos assimétricos, evitando três colunas idênticas sem ênfase;
- revisão em coluna única com cards densos e hierarquia mais explícita;
- explicação visualmente secundária à correção, mas ainda fácil de encontrar.

### Microcopy

O topo da tela DEVE trocar o título neutro "Resultado do quiz" por um conjunto
mais orientado a fechamento de sessão, contendo:

- título principal curto;
- faixa de desempenho;
- frase de leitura humana compatível com a nota.

Essa frase pode variar por faixa de score, mas deve evitar linguagem de jogo,
marketing ou celebração excessiva.

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | --- | --- |
| 1 | a tentativa tiver score baixo | manter tom respeitoso e orientado a revisão, sem linguagem punitiva |
| 2 | a tentativa tiver questões sem resposta | destacar "não respondida" com clareza equivalente a erro, sem confundir com resposta incorreta |
| 3 | a explicação de uma questão for longa | preservar legibilidade com espaçamento e contraste secundário, sem dominar o card |
| 4 | o usuário revisar em tela estreita | empilhar hero, métricas e revisão sem exigir zoom ou leitura lateral |
| 5 | houver muitas questões | manter ritmo visual consistente, sem cards excessivamente altos por decoração desnecessária |
| 6 | a questão tiver múltiplas respostas corretas | tornar "sua resposta" e "resposta correta" legíveis sem depender apenas da cor |

## Questões em aberto

Nenhuma.

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test -- --run src/features/quiz
npm run docs-check                # exit 0
```

Critérios funcionais:

- hero final comunica score e faixa de desempenho com hierarquia superior à da
  lista de revisão;
- métricas não usam mais três blocos visualmente equivalentes;
- cards de revisão deixam inequívoco o status da questão e a distinção entre
  resposta do usuário, gabarito e explicação;
- layout permanece legível em desktop e mobile;
- redesign preserva os dados e interações existentes da rota de resultado.

## Revisão humana

- Validar se o tom visual final transmite estudo e progresso, sem parecer game
  nem dashboard administrativo.
- Revisar contraste, legibilidade e ritmo visual dos cards de revisão em uma
  tentativa longa.
- Verificar se a frase humana do hero soa natural em português para faixas alta,
  média e baixa de desempenho.

## Verificação

```text
(preencher no fechamento)
```

---
status: draft               # draft | accepted | implemented | deprecated
date: AAAA-MM-DD
builds-on: []               # ADRs que fundamentam. A spec CONSOME decisões, não as redefine.
implemented-by: []          # paths reais (código, migrations, functions) — preenchido no fechamento
---

<!-- id é DERIVADO do filename (docs/specs/NNNN-titulo-kebab.md → SPEC-NNNN);
     title é DERIVADO do H1 abaixo. -->

# <comportamento em uma frase — vira o title derivado>

> Convenções compartilhadas (envelope de erro, autorização, acesso a dados):
> `docs/context/CONVENTIONS.md`. Esta spec não as repete — só desvia delas
> explicitamente quando necessário.

## Objetivo
<!-- O que o usuário/sistema consegue fazer quando isto estiver implementado. -->

## Fluxo
<!-- Passo a passo do comportamento observável. -->

## Contrato
<!-- API/eventos/UI: entradas, saídas, formatos. O que é garantido. -->

## Casos de borda
<!-- Enumerados e DECIDIDOS. Formato sugerido: EARS, agnóstico de stack.
     Caso sem decisão NÃO fica aqui — vai para Questões em aberto. -->

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
|---|---|---|
| 1 |  |  |

## Questões em aberto
<!-- Cada item BLOQUEIA o ponto correspondente da implementação —
     o agente não improvisa sobre questão aberta. -->

- [ ] 

## Definition of Done
<!-- OBRIGATÓRIO antes de sair de draft. Comandos com critério binário,
     executáveis no ambiente do AGENTS.md. -->

```bash
npm run typecheck                 # exit 0
npm test -- --run <escopo>        # N/N verdes
```

## Revisão humana
<!-- O que exige olho humano e NÃO está no loop do agente. -->

- 

## Verificação
<!-- Preenchida no FECHAMENTO (transição para implemented, mesmo commit que
     preenche implemented-by): evidência do DoD — comandos rodados + resultado. -->

```text
(preencher no fechamento)
```

<!-- Checklist de fechamento (um commit):
     [ ] DoD verde, evidência acima
     [ ] status: implemented + implemented-by com paths reais
     [ ] gotchas novos → AGENTS.md
     [ ] estado atual novo → capítulo de contexto pertinente
     [ ] scripts/docs-check --emit-index (READMEs regenerados) -->

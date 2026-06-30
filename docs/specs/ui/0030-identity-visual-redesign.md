---
status: implemented
date: 2026-06-29
builds-on: [ADR-0001, SPEC-0005]
implemented-by:
  - src/globals.css
  - src/routes/__root/-index.tsx
  - src/components/logo.tsx
  - src/components/app-shell.tsx
  - src/components/app-header.tsx
  - src/components/app-nav-desktop.tsx
  - src/components/app-nav-mobile.tsx
  - src/components/app-account-menu.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/input.tsx
  - src/components/ui/badge.tsx
  - src/routes/login/index.tsx
  - src/features/admin/components/dashboard.tsx
  - src/features/quiz/pages/quiz-config-page.tsx
  - src/features/quiz/pages/quiz-session-page.tsx
  - src/features/quiz/pages/quiz-result-page.tsx
  - src/features/quiz/components/quiz-start.tsx
  - src/features/quiz/components/quiz-config-form.tsx
  - src/features/quiz/components/quiz-question-card.tsx
  - src/features/quiz/components/quiz-navigation.tsx
  - src/features/quiz/components/quiz-result-summary.tsx
  - src/features/quiz/components/quiz-answer-review.tsx
  - src/features/quiz/components/quiz-loading.tsx
  - src/features/exams/pages/exam-detail-page.tsx
  - src/features/exams/pages/exam-question-page.tsx
  - src/features/exams/components/exam-detail-header.tsx
  - src/features/exams/components/exam-detail-actions.tsx
  - src/features/exams/components/exam-question-list.tsx
  - src/features/exams/components/exam-question-list-item.tsx
  - src/features/exams/components/exams-list.tsx
  - src/features/exams/components/ingest-upload-form.tsx
  - src/features/profile/pages/profile-page.tsx
  - src/features/admin/components/admin-dashboard-shell.tsx
  - package.json
---

# Redesign visual: identidade acadêmica premium

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Esta spec consome o shell da
> área logada (SPEC-0005) e redefine apenas a camada visual (cores, tipografia, componentes
> base) sem alterar arquitetura de rotas ou de dados.

## Objetivo

O app adota uma identidade visual coesa, distinta do padrão shadcn neutral, alinhada à
proposta de “atelier acadêmico frio/técnico”: precisão de arquivo universitário, paleta
escura puxada para cinza-azulado, destaque em cobre apagado e tipografia serifada para
títulos. O redesign aplica-se ao tema escuro e claro, respeitando a preferência do sistema.

## Fluxo

### Aplicação do design system

1. Variáveis CSS em `src/globals.css` são redefinidas para a paleta e radius aprovados.
2. Fontes `DM Serif Display` e `Newsreader` são carregadas no entrypoint da aplicação.
3. Componentes shadcn base (`button`, `card`, `input`, `badge`) são ajustados para usar as
   novas cores e bordas.
4. Logo mantém a estrutura de bolinhas; suas cores passam a usar variáveis do tema.
5. Header, navegação e shell ajustam espaçamento e estados de hover/foco.
6. Páginas principais são revisadas para garantir hierarquia tipográfica e legibilidade.

### Experiência do usuário

1. Usuário abre o app — tema segue preferência do sistema.
2. Área logada exibe header fixo minimalista com navegação em texto puro.
3. Cards e painéis usam superfícies escuras com bordas finas, sem sombras.
4. Botões primários usam destaque cobre sólido.
5. Títulos e números grandes usam serif display; textos de interface usam sans.

## Contrato

### Paleta — modo escuro

| Token | Hex | Uso |
| --- | --- | --- |
| `background` | `#0D0F12` | Fundo geral |
| `surface` | `#111418` | Cards, painéis |
| `surface-elevated` | `#161B20` | Hover, dropdowns, popovers |
| `border` | `#232A31` | Bordas de cards, divisores |
| `border-strong` | `#323C46` | Inputs, foco sutil |
| `text` | `#D8DDE4` | Texto primário |
| `text-secondary` | `#8B96A3` | Texto secundário, labels |
| `text-muted` | `#5D6974` | Placeholders, desativado |
| `accent` | `#A87A60` | Destaque cobre apagado |
| `accent-hover` | `#BF8F72` | Hover do destaque |
| `accent-foreground` | `#0D0F12` | Texto sobre destaque |
| `success` | `#5A8D74` | Estados positivos |
| `destructive` | `#B45A5A` | Erros |

### Paleta — modo claro

| Token | Hex | Uso |
| --- | --- | --- |
| `background` | `#F7F5F2` | Fundo geral (papel frio) |
| `surface` | `#FFFFFF` | Cards, painéis |
| `surface-elevated` | `#EDEAE6` | Hover |
| `border` | `#D8D4CE` | Bordas |
| `border-strong` | `#B8B2AA` | Inputs |
| `text` | `#1A1F24` | Texto primário |
| `text-secondary` | `#5A636C` | Texto secundário |
| `text-muted` | `#8A939D` | Placeholders |
| `accent` | `#9C6B52` | Destaque cobre mais escuro no claro |
| `accent-hover` | `#B37E62` | Hover |
| `accent-foreground` | `#FFFFFF` | Texto sobre destaque |

### Tipografia

| Papel | Fonte | Uso |
| --- | --- | --- |
| Display | `DM Serif Display` | Títulos de página, números grandes do dashboard |
| Serif | `Newsreader` | Títulos de cards, headings h2/h3 |
| UI / body | `Inter` | Textos de interface, labels, botões, parágrafos |

### Escala tipográfica

| Token | Tamanho | Peso | Uso |
| --- | --- | --- | --- |
| `text-hero` | 48px / 32px mobile | 400 | Título grande (login) |
| `text-h1` | 32px | 400 | Título de página |
| `text-h2` | 24px | 400 | Seção |
| `text-h3` | 18px | 500 | Card title, subseção |
| `text-body` | 15px | 400 | Parágrafos, descrições |
| `text-small` | 13px | 400 | Labels, metadados |
| `text-xs` | 11px | 500 uppercase | Eyebrows, badges |

### Componentes base

#### Botão primário

- Fundo `accent`; texto `accent-foreground`.
- Padding `10px 16px`; border-radius `6px`; fonte 14px peso 500.
- Hover: `accent-hover`; foco: ring `2px accent/30%`.

#### Botão secundário / ghost

- Fundo transparente; borda `border`; texto `text`.
- Hover: `surface-elevated`.

#### Card

- Fundo `surface`; borda `1px solid border`; border-radius `8px`.
- Sem sombra; padding `20px`–`24px`.
- Hover sutil: borda `border-strong`.

#### Input

- Fundo `background`; borda `1px solid border-strong`; border-radius `6px`.
- Padding `10px 12px`; foco: ring `accent/25%`, borda `accent`.

#### Badge

- Fundo `surface-elevated`; borda `1px solid border`; texto `text-secondary`.
- 11px peso 500; border-radius `999px`.

### Layout

- Header fixo: altura `56px`; fundo `background` com `backdrop-blur` 90%; borda inferior `border`.
- Container de conteúdo: `max-width: 920px`; padding lateral `24px`; vertical `32px`; centralizado.
- Navegação desktop: links inline em `text-secondary`, 14px, 400; ativo em `text`; hover com fundo `surface-elevated` arredondado `6px`.

### Logo

- Mantém a estrutura existente em `src/components/logo.tsx`.
- Cores das bolinhas passam a usar variáveis do tema:
  - Escuro: `accent`, `text-secondary`, `text-muted`.
  - Claro: `accent`, `text-secondary`, `text-muted`.

### Páginas no escopo inicial do redesign

| Página | Arquivo |
| --- | --- |
| Login | `src/routes/login/index.tsx` |
| Dashboard | `src/features/admin/components/dashboard.tsx` |
| Configuração de quiz | `src/features/quiz/pages/quiz-config-page.tsx` |
| Sessão de quiz | `src/features/quiz/pages/quiz-session-page.tsx` |
| Lista de provas | `src/features/exams/pages/exams-page.tsx` |
| Detalhe da prova | `src/features/exams/pages/exam-detail-page.tsx` |
| Perfil | `src/features/profile/pages/profile-page.tsx` |

### Fora de escopo

- Redesenho do símbolo/estrutura do logo.
- Mudança de nome do produto.
- Alteração da arquitetura de rotas ou do shell (fora de ajustes visuais).
- Reescrita de conteúdo ou fluxos funcionais das páginas.
- Telas de admin (mantêm estrutura, mas herdarão as variáveis de cor).

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
| --- | --- | --- |
| 1 | QUANDO o sistema detecta preferência clara do OS | aplicar o tema correspondente com paleta aprovada |
| 2 | QUANDO o usuário alterna manualmente claro/escuro | refletir imediatamente sem recarregar a página |
| 3 | QUANDO uma tela usa o tema claro | manter contraste mínimo WCAG AA para textos |
| 4 | QUANDO o logo é renderizado no header ou em outros contextos | usar as cores do tema sem importar bolinhas azuis/verde legadas |
| 5 | QUANDO um card recebe hover/foco | elevar sutilmente a borda, não aplicar sombra |
| 6 | QUANDO um botão primário recebe foco via teclado | exibir ring `accent/30%` sem sobrepor conteúdo |

## Questões em aberto

_(nenhuma — design aprovado em brainstorming 2026-06-29)_

## Definition of Done

```bash
npm run typecheck                 # exit 0
npm test                          # tudo verde
npm run docs-check                # exit 0
```

Critérios:

- Variáveis CSS refletem a paleta aprovada para escuro e claro.
- Fontes `DM Serif Display` e `Newsreader` carregam sem flash.
- Componentes base (`button`, `card`, `input`, `badge`) usam a nova paleta e bordas.
- Logo herda cores do tema; azul/verde legado não aparece mais.
- Header, navegação e shell seguem o layout minimalista aprovado.
- Páginas listadas mantêm funcionalidade com hierarquia tipográfica revisada.
- `docs-check` exit 0 com SPEC-0030 indexada.

## Revisão humana

- Navegar entre login, dashboard, provas, quiz e perfil e confirmar consistência visual.
- Testar tema claro/escuro e transição suave.
- Verificar legibilidade de textos longos (quiz, enunciados de questões).

## Verificação

```text
- npm run typecheck: exit 0 (5 erros preexistentes em features/exams fora do escopo visual)
- npm test: 565 passaram, 6 falhas preexistentes em run-ingest.test.ts (db.query.questionTopics undefined — schema/migrations D1)
- npm run docs-check: exit 0 após regeneração de índices
- Fontes @fontsource/dm-serif-display e @fontsource/newsreader carregadas via globals.css
- globals.css redefinido com paleta acadêmica fria e radius aprovados
- Componentes base (button, card, input, badge), shell e páginas principais revisados
- Teste exam-detail-actions.spec.tsx atualizado para refletir nova copy do diálogo
```

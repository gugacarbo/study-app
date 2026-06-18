---
status: accepted
date: 2026-06-18
builds-on: [ADR-0001, ADR-0003, ADR-0004]
implemented-by: []
---

# Shell da área logada: navegação content-first

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Navegação interna usa `Link` /
> `useNavigate` — nunca `<a href="/...">` para rotas do app.

## Objetivo

Usuário autenticado navega o app com chrome mínimo (visual de app, não dashboard): header com
título da página, rotas principais e conta; conteúdo ocupa a altura útil sem tab bar fixa.
Mesma estrutura em mobile e desktop — frame centralizado, sem layout expandido tipo painel.

## Fluxo

### Montagem da shell

1. `RootLayout` em `src/routes/__root.tsx` lê contexto do layout pathless `/_app`.
2. Com `appContext.user`, renderiza `AppShell` envolvendo `<Outlet />`.
3. Sem usuário (login, admin fora de `/_app`) → `<Outlet />` sem `AppShell`.

### Navegação — desktop (`md` e acima)

1. Header exibe título contextual (`getAppPageTitle`) à esquerda.
2. Links inline visíveis à direita: Início · Provas · Importar (`APP_NAV_ITEMS`).
3. Clique em link → navegação SPA via `Link` do TanStack Router.
4. Item ativo destacado por cor de texto (discreto, sem pill de dashboard).

### Navegação — mobile (abaixo de `md`)

1. Links inline ocultos; botão Menu (`aria-label="Menu"`) visível no header.
2. Clique abre Sheet shadcn pela esquerda com a mesma lista de rotas.
3. Seleção de rota → `navigate({ to })` + fechar sheet.
4. Sheet fecha também por overlay, Escape e botão fechar.

### Conta

1. Avatar com iniciais sempre visível no header (separado do menu de rotas).
2. Dropdown: Perfil (disabled), Administração (se `isAdmin`), Alternar tema, Sair.
3. Administração → `navigate({ to: "/admin/config" })`.
4. Sair → `authClient.signOut()` + `navigate({ to: "/login" })`.

## Contrato

### Arquitetura de componentes

| Componente       | Path                              | Responsabilidade                                      |
| ---------------- | --------------------------------- | ----------------------------------------------------- |
| `AppShell`       | `src/components/app-shell.tsx`    | Container, `<main>`, compõe header                    |
| `AppHeader`      | `src/components/app-header.tsx`   | Título + slot nav + avatar                            |
| `AppNavDesktop`  | `src/components/app-nav-desktop.tsx` | Links inline (`md+`)                               |
| `AppNavMobile`   | `src/components/app-nav-mobile.tsx`  | Trigger + Sheet (`<md`)                             |
| `AppAccountMenu` | `src/components/app-account-menu.tsx` | Dropdown de conta                                 |
| Nav items        | `src/lib/app-nav.ts`              | `APP_NAV_ITEMS`, `getAppPageTitle` — fonte única      |

```
__root.tsx (RootLayout)
  └── AppShell (se appContext.user)
        ├── AppHeader
        │     ├── título (getAppPageTitle)
        │     ├── AppNavDesktop (md+)
        │     ├── AppNavMobile (<md)
        │     └── AppAccountMenu
        └── <main>{children}</main>
```

### Layout (`AppShell`)

| Elemento   | Classes / regra                                                                 |
| ---------- | ------------------------------------------------------------------------------- |
| Container  | `mx-auto flex h-dvh w-full max-w-2xl flex-col bg-background`                   |
| `<main>`   | `flex-1 overflow-y-auto px-4 py-4` — **sem** `pb-24`                          |
| Header     | `h-14`, `border-b`, `backdrop-blur` opcional                                    |
| Título     | `text-sm font-semibold truncate` — **sem** subtítulo "Study App"                |

### Rotas de navegação (v1)

| Label    | `to`          | Ativo quando                                                          |
| -------- | ------------- | --------------------------------------------------------------------- |
| Início   | `/`           | `pathname === "/"`                                                    |
| Provas   | `/exams`      | `/exams` ou `/exams/*` exceto `/exams/new`                            |
| Importar | `/exams/new`  | `pathname === "/exams/new"`                                           |

### Mecanismos de navegação

| Contexto           | Mecanismo                         |
| ------------------ | --------------------------------- |
| Desktop links      | `Link` com `to`                   |
| Mobile sheet items | `useNavigate()` + fechar sheet    |
| Admin no dropdown  | `onSelect` + `navigate()`         |

### Dependência

- Componente `Sheet` shadcn em `src/components/ui/sheet.tsx`.

### Fora de escopo

- Redesign de páginas internas além de remover dependência da tab bar.
- `AdminShell` e página de login.
- Novos itens de nav (quiz, stats, chat).
- Replicação do shell legado (nav + dock lateral — ADR-0001).

## Casos de borda

| #   | QUANDO o usuário redimensiona a janela cruzando `md`       | o sistema DEVE alternar entre links inline e botão Menu sem reload |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | QUANDO o usuário abre o sheet e seleciona a rota atual      | o sistema DEVE fechar o sheet sem erro                             |
| 2   | QUANDO o usuário é admin                                    | o sistema DEVE exibir "Administração" no dropdown do avatar        |
| 3   | QUANDO o usuário não é admin                                | o sistema DEVE ocultar "Administração"                             |
| 4   | QUANDO o usuário navega entre rotas do app                  | o sistema DEVE manter navegação SPA (sem full page reload)         |
| 5   | QUANDO o título da página muda de rota                      | o sistema DEVE atualizar o título no header                        |

## Questões em aberto

_(nenhuma — design aprovado em brainstorming 2026-06-18)_

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/components/app-shell
npm run docs-check
```

Critérios:

- Tab bar removida; conteúdo sem padding extra para barra inferior.
- Desktop: links Início/Provas/Importar visíveis e navegam.
- Mobile: sheet abre, navega e fecha.
- Avatar: tema, sair e admin (quando aplicável) funcionam.
- `docs-check` exit 0 com SPEC-0005 indexada.

## Revisão humana

- Navegar `/` → `/exams` → `/exams/new` sem flash de reload.
- Redimensionar janela: transição desktop ↔ mobile no breakpoint `md`.
- Tema claro/escuro no header e sheet.

## Verificação

```text
(preencher no fechamento)
```

# App Shell Layout — Design Spec

**Date:** 2026-06-18  
**Status:** approved (brainstorming)  
**Scope:** Redesign completo da shell da área logada (`AppShell`)

## Objetivo

Substituir a shell atual (header + tab bar fixa embaixo) por um layout **content-first** — estilo Instagram/Spotify — com chrome mínimo, mesma estrutura em todas as telas (sem expansão tipo dashboard), navegação no header e conta separada no avatar.

## Decisões de produto

| Tema | Decisão |
|------|---------|
| Escopo | Redesign de estrutura e visual |
| Personalidade | Conteúdo em primeiro lugar; chrome discreto |
| Formato | Mesma estrutura em mobile e desktop; frame centralizado, não dashboard expandido |
| Navegação desktop | Links inline no header (Início · Provas · Importar) |
| Navegação mobile | Botão Menu abre Sheet colapsável pela esquerda |
| Header fixo | Título da página + navegação + avatar |
| Conta | Avatar separado com dropdown (perfil, admin, tema, sair) — como hoje |
| Tab bar | Removida |

## Arquitetura

### Abordagem escolhida: shell composta

`AppShell` orquestra subcomponentes focados. Fonte única de itens em `src/lib/app-nav.ts` (`APP_NAV_ITEMS`, `getAppPageTitle`).

```
__root.tsx (RootLayout)
  └── AppShell (se appContext.user)
        ├── AppHeader
        │     ├── título (getAppPageTitle)
        │     ├── AppNavDesktop (md+)
        │     ├── AppNavMobile (sheet, <md)
        │     └── AppAccountMenu
        └── <main>{children}</main>
```

### Integração com rotas

- Montagem permanece em `src/routes/__root.tsx` — condicional a `appContext?.user` do layout pathless `/_app`.
- `/_app/route.tsx` continua só com guard de sessão + `<Outlet />`; sem shell.
- Admin (`AdminShell`) e login permanecem fora desta shell.

## Componentes

### `AppShell`

- Container: `mx-auto flex h-dvh w-full max-w-2xl flex-col bg-background`
- `<main>`: `flex-1 overflow-y-auto px-4 py-4` — **sem** `pb-24` (tab bar removida)
- Props: `user`, `isAdmin`, `children` (inalteradas)

### `AppHeader`

- Altura `h-14`, `border-b`, `backdrop-blur` leve opcional
- Layout flex: título à esquerda; nav + avatar à direita
- Título: `getAppPageTitle(pathname)` — `text-sm font-semibold truncate`
- **Sem** subtítulo "Study App"

### `AppNavDesktop`

- Visível apenas `md:` e acima (`hidden md:flex`)
- Renderiza `APP_NAV_ITEMS` como `Link` do `@tanstack/react-router` com prop `to`
- Estado ativo via `item.match(pathname)`:
  - Ativo: `text-foreground font-medium`
  - Inativo: `text-muted-foreground hover:text-foreground`
- Estilo discreto (texto, não pill de dashboard)

### `AppNavMobile`

- Visível apenas abaixo de `md` (`md:hidden`)
- Botão ícone Menu (`aria-label="Menu"`) abre `Sheet` shadcn pela esquerda
- Lista as mesmas rotas de `APP_NAV_ITEMS`
- Ao selecionar rota: `navigate({ to })` + fechar sheet
- Sheet fecha também por overlay, Escape e botão fechar

### `AppAccountMenu`

- Extraído do shell atual: avatar com iniciais, dropdown
- Itens: Perfil (disabled), Administração (se `isAdmin`), Alternar tema, Sair
- Navegação admin via `onSelect` + `useNavigate` (não `Link` + `asChild`)
- Sign out: `authClient.signOut()` + `navigate({ to: "/login" })`

### Dependência nova

- Adicionar componente `Sheet` via shadcn (`src/components/ui/sheet.tsx`)

## Navegação e data flow

| Contexto | Mecanismo | Convenção |
|----------|-----------|-----------|
| Desktop links | `Link` com `to` | SPA, sem reload |
| Mobile sheet items | `useNavigate()` + fechar sheet | SPA, sem reload |
| Admin no dropdown | `onSelect` + `navigate()` | Igual ao padrão atual |
| URLs externas | `<a>` com `target="_blank"` | Exceção permitida |

`pathname` via `useRouterState({ select: (s) => s.location.pathname })`.

## Tratamento visual

- **Content-first:** header fino; conteúdo ocupa altura útil inteira
- **Frame:** `max-w-2xl` (antes `max-w-lg`) — cabe título + 3 links + avatar sem apertar; ainda app-like
- **Tipografia:** título da página `text-sm font-semibold`; conteúdo das rotas mantém hierarquia própria
- **Estados ativos:** cor de texto, sem fundo pesado
- **Tema claro/escuro:** herda `ThemeProvider`; sheet e header usam tokens `background`, `border`, `muted-foreground`
- **Acessibilidade:** `aria-label` no menu mobile; `aria-current="page"` no item ativo; `sr-only` no trigger

## Fora de escopo

- Redesign de páginas internas (`/_app/index`, exams, etc.) além de remover dependência visual da tab bar
- Alteração do `AdminShell`
- Novos itens de navegação (quiz, stats, chat) — `APP_NAV_ITEMS` permanece com 3 rotas atuais
- Replicação do shell legado (nav + dock lateral — proibido por ADR-0001)

## Testes

### `app-shell.spec.tsx` (atualizar)

- Remover asserções de bottom navigation
- Desktop (viewport largo): links Início/Provas/Importar visíveis; clique navega
- Mobile (viewport estreito): links inline ausentes; botão Menu abre sheet; item navega e fecha
- Avatar: admin link visível quando `isAdmin`; sign out chama `authClient.signOut`

### Novos testes (opcional, se arquivo separado)

- `app-nav-desktop.spec.tsx` / `app-nav-mobile.spec.tsx` — estado ativo por pathname

### Verificação manual

- Navegar entre `/`, `/exams`, `/exams/new` sem full page reload
- Redimensionar janela: transição desktop inline ↔ mobile sheet em breakpoint `md`
- Tema claro/escuro no header e sheet

## Verificação (DoD)

```bash
npm run typecheck   # exit 0
npm test            # exit 0
```

## Mockups

Brainstorm visual companion: `.superpowers/brainstorm/194951-1781792260/content/app-shell-layout.html` (gitignored)

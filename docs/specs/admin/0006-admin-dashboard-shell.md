---
status: implemented
date: 2026-06-18
builds-on: [ADR-0004, SPEC-0005]
implemented-by:
  - src/components/ui/sidebar.tsx
  - src/components/ui/tooltip.tsx
  - src/hooks/use-mobile.ts
  - src/lib/admin-nav.ts
  - src/lib/admin-nav.test.ts
  - src/lib/sidebar-cookie.ts
  - src/lib/sidebar-cookie.test.ts
  - src/features/admin/components/admin-dashboard-shell.tsx
  - src/features/admin/components/admin-dashboard-shell.spec.tsx
  - src/features/admin/components/admin-sidebar.tsx
  - src/features/admin/components/admin-sidebar-nav.tsx
  - src/features/admin/components/admin-sidebar-nav.spec.tsx
  - src/features/admin/components/admin-sidebar-footer.tsx
  - src/features/admin/components/admin-sidebar-footer.spec.tsx
  - src/features/admin/components/admin-account-menu.tsx
  - src/features/admin/components/admin-main-header.tsx
  - src/features/admin/components/admin-main-header.spec.tsx
  - src/routes/admin/route.tsx
  - src/features/admin/pages/admin-config-page.tsx
  - src/features/admin/pages/admin-users-page.tsx
  - src/features/admin/pages/admin-jobs-page.tsx
  - src/features/admin/pages/admin-users-page.spec.tsx
---

# Admin: shell dashboard com sidebar shadcn

> Convenções: `docs/context/CONVENTIONS.md`. Navegação interna usa `useNavigate` /
> `Link` — nunca `<a href="/...">` para rotas do app. Contraste explícito com
> SPEC-0005 (app content-first, sem dashboard).

## Objetivo

Administrador (`admin:access`) navega `/admin/*` em shell tipo dashboard: sidebar
esquerda (shadcn), barra fina com título da página, conteúdo full-width em desktop.
Troca total de contexto em relação ao `AppShell` — sem header do app. Mobile usa
sheet para a sidebar; estado colapsado da sidebar persiste em cookie.

## Fluxo

### Montagem da shell

1. `AdminLayout` em `src/routes/admin/route.tsx` monta `AdminDashboardShell` após
   `requireAdminSession` (guard existente).
2. `AdminDashboardShell` envolve `<Outlet />` com `SidebarProvider` + sidebar + inset.
3. `__root.tsx` **não** envolve admin em `AppShell` (inalterado — SPEC-0005).
4. Páginas admin (`config`, `users`, `jobs`) renderizam só conteúdo — sem wrapper
   `AdminShell` por página.

### Navegação — desktop (`lg` e acima)

1. Sidebar expandida por padrão (ou estado do cookie `study-app-sidebar`).
2. Itens Config · Usuários · Jobs (`ADMIN_NAV_ITEMS`) com ícone + label.
3. Clique → `useNavigate({ to })` (SPA, sem reload).
4. Item ativo destacado na sidebar.
5. Toggle colapsa sidebar para modo ícone + tooltip; persiste em cookie.

### Navegação — mobile (abaixo de `lg`)

1. Sidebar oculta; `SidebarTrigger` (☰) na barra do main abre sheet.
2. Mesmos itens de nav + footer dentro do sheet.
3. Seleção de rota → `navigate` + fechar sheet.

### Barra do main (`AdminMainHeader`)

1. `SidebarTrigger` + título (`getAdminPageTitle(pathname)`).
2. Título derivado de `src/lib/admin-nav.ts` — fonte única.

### Rodapé da sidebar

1. **Voltar ao app** → `navigate({ to: "/" })`.
2. **Alternar tema** → `useTheme` (mesmo comportamento do app).
3. **Conta** → avatar + dropdown com nome/email e **Sair** (`authClient.signOut` →
   `/login`). Sem link “Administração” (já está no admin).

## Contrato

### Arquitetura de componentes

| Componente              | Path                                                       | Responsabilidade                    |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `AdminDashboardShell`   | `src/features/admin/components/admin-dashboard-shell.tsx`  | Provider, layout, `<Outlet />`      |
| `AdminSidebar`          | `src/features/admin/components/admin-sidebar.tsx`          | Composição nav + footer              |
| `AdminSidebarNav`       | `src/features/admin/components/admin-sidebar-nav.tsx`      | Lista de rotas admin                 |
| `AdminSidebarFooter`    | `src/features/admin/components/admin-sidebar-footer.tsx`   | Voltar, tema, conta                  |
| `AdminMainHeader`       | `src/features/admin/components/admin-main-header.tsx`      | Trigger + título                     |
| Nav items               | `src/lib/admin-nav.ts`                                     | `ADMIN_NAV_ITEMS`, `getAdminPageTitle` |
| Cookie sidebar          | `src/lib/sidebar-cookie.ts`                                | `expanded` \| `collapsed`            |
| `sidebar` (shadcn)      | `src/components/ui/sidebar.tsx`                            | Primitivos UI                        |

```
admin/route.tsx (AdminLayout)
  └── AdminDashboardShell
        ├── AdminSidebar
        │     ├── AdminSidebarNav
        │     └── AdminSidebarFooter
        └── SidebarInset
              ├── AdminMainHeader
              └── <main>{children}</main>
```

### Layout

| Elemento        | Classes / regra                                                              |
| --------------- | ---------------------------------------------------------------------------- |
| Shell root      | `flex min-h-dvh w-full` — **sem** `max-w-4xl`                                |
| `SidebarInset`  | `flex flex-col flex-1`                                                       |
| Main header     | `flex h-14 items-center gap-2 border-b px-4`                                 |
| Main content    | `flex-1 overflow-y-auto p-4 lg:p-6`                                          |
| Mobile (`<lg`)  | inner do main: `max-w-lg mx-auto w-full`                                     |
| Desktop (`lg+`) | conteúdo full width do inset                                                  |

### Cookie `study-app-sidebar`

| Valor       | Significado        |
| ----------- | ------------------ |
| `expanded`  | Sidebar com labels |
| `collapsed` | Modo ícone         |

- `path=/`, `SameSite=Lax`, `max-age` 1 ano.
- Leitura no client ao montar `SidebarProvider`; escrita ao togglear.
- SSR/default: `expanded`.

### Rotas de navegação (v1)

| Label    | `to`             | Ativo quando              |
| -------- | ---------------- | ------------------------- |
| Config   | `/admin/config`  | prefixo `/admin/config`   |
| Usuários | `/admin/users`   | prefixo `/admin/users`    |
| Jobs     | `/admin/jobs`    | prefixo `/admin/jobs`     |

### Fora de escopo

- Novas rotas admin (logs SPEC-0015, benchmark SPEC-0017).
- Redesign de tabelas/painéis das páginas existentes.
- Migrar tema de `localStorage` para cookie.
- `AdminShell` legado — removido nesta spec.

## Casos de borda

| #   | QUANDO o admin colapsa a sidebar                          | o sistema DEVE persistir estado no cookie e restaurar no próximo load |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | QUANDO o admin abre admin a partir do app               | o sistema DEVE exibir shell dashboard sem `AppShell`                  |
| 2   | QUANDO o admin toca “Voltar ao app”                     | o sistema DEVE navegar para `/` com SPA                               |
| 3   | QUANDO o usuário redimensiona cruzando `lg`             | o sistema DEVE alternar sidebar fixa ↔ sheet sem reload               |
| 4   | QUANDO o admin seleciona rota no sheet mobile           | o sistema DEVE fechar o sheet                                         |
| 5   | QUANDO usuário sem `admin:access` acessa `/admin/*`     | o sistema DEVE responder 404 (guard existente — inalterado)           |

## Questões em aberto

_(nenhuma — design aprovado em brainstorming 2026-06-18)_

## Definition of Done

```bash
npm run typecheck
npm test -- --run src/features/admin/components/admin-dashboard-shell
npm test -- --run src/features/admin/pages
npm run docs-check
```

Critérios:

- `AdminShell` removido; shell montada em `admin/route.tsx`.
- Sidebar shadcn instalada; nav Config/Users/Jobs funciona em desktop e mobile sheet.
- Cookie `study-app-sidebar` persiste colapso.
- Footer: voltar, tema, sair funcionam.
- Conteúdo full-width em `lg+`; contido em mobile.
- `docs-check` exit 0 com SPEC-0006 indexada.

## Revisão humana

- App → Administração → dashboard sem header do app; Voltar ao app retorna à área logada.
- Colapsar sidebar, recarregar — estado mantido.
- Redimensionar desktop ↔ mobile no breakpoint `lg`.

## Verificação

```text
npm run typecheck                                              # exit 0
npm test -- --run src/features/admin/components/admin-dashboard-shell  # 7 passed
npm test -- --run src/features/admin/pages                     # 2 passed (2 files)
npm run docs-check                                             # exit 0 (27 docs)
grep -r AdminShell src/                                        # (vazio)
```

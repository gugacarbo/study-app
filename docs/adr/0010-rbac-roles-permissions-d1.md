---
status: accepted
date: 2026-06-17
builds-on: [ADR-0002, ADR-0004]
deciders: []
---

# Gestão de roles e permissões em D1 (RBAC)

## Contexto e problema

O app precisa distinguir usuário comum de administrador (`/admin/*`, atribuição de roles). Allowlist por email em env (ADR-0009) não escala: exige redeploy para cada admin e não modela permissões finas.

Better Auth cuida de **autenticação** (sessão, magic link). **Autorização** (roles/permissões) fica no domínio do app, persistida em D1, consultada em todo `requireSession` de domínio e guard de admin.

## Direcionadores da decisão

- Mesmo D1 do domínio (ADR-0002) — sem serviço externo de IAM
- Better Auth **sem** Admin plugin para roles — tabelas próprias, controle total
- v1: catálogo fixo `user` + `admin`; schema suporta expansão futura
- Admin opera **só** com dados do próprio `user_id` — sem super-user cross-tenant na v1
- Falha opaca: sem permissão → **404** (rotas admin) ou **401** (API)
- Bootstrap do primeiro admin via `ADMIN_EMAILS` no signup — depois só via `set-user-role`

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| Tabelas D1 (`roles`, `permissions`, `user_roles`) | **Escolhida** |
| Better Auth Admin plugin (`user.role` string) | Rejeitado — roles dinâmicas futuras, permissões granulares |
| `ADMIN_EMAILS` permanente (ADR-0009) | **Supersedido** — só bootstrap |
| Organization plugin Better Auth | Rejeitado — multi-tenant org é outro modelo |

## Decisão

### Modelo de dados (D1)

Detalhe de colunas: SPEC-0001 (seção RBAC).

| Tabela | Uso |
|--------|-----|
| `roles` | Catálogo — `key` unique (`user`, `admin` na v1) |
| `permissions` | Catálogo — `key` unique (`app:use`, `admin:access` na v1) |
| `role_permissions` | N:N role → permissions |
| `user_roles` | N:N `user_id` → `roles` (FK `user.id` cascade) |

PKs: UUID `text` em `roles`, `permissions`; composite PK em junctions.

**Seed v1** (migration inicial):

| Role | Permissions |
|------|-------------|
| `user` | `app:use` |
| `admin` | `app:use`, `admin:access` |

Todo usuário autenticado recebe role `user` no signup. Emails em `ADMIN_EMAILS` recebem **também** `admin` (hook pós-criação).

### Bootstrap (`ADMIN_EMAILS`)

| Momento | Comportamento |
|---------|----------------|
| `user.create` (signup) | Atribuir role `user`; se email ∈ `ADMIN_EMAILS` → atribuir `admin` |
| Login subsequente | Não reavaliar env — role só muda via `set-user-role` |
| Env alterado | Não retroage em usuários existentes |

`ADMIN_EMAILS`: comma-separated, trim + lowercase — mesmo formato da ADR-0009.

### Resolução de permissões (servidor)

Módulo `src/lib/rbac.ts`:

```ts
getUserRoles(userId): Promise<string[]>      // keys: "user", "admin"
getUserPermissions(userId): Promise<Set<string>>
userHasPermission(userId, permission): Promise<boolean>
```

Carregar de D1 em cada request autenticado (join `user_roles` → `role_permissions` → `permissions`). Cache in-request aceitável; **não** confiar em role no client.

Guards em `src/functions/auth/`:

| Guard | Regra |
|-------|--------|
| `requireSession` | Sessão válida + `app:use` |
| `requireAdminSession` | `requireSession` + `admin:access` |

Rotas `src/routes/admin.*`: `beforeLoad` com `requireAdminSession` → falha **404**.

### Atribuição de roles

`setUserRole` em `src/functions/admin/`:

- Caller deve ter `admin:access`
- v1: só pode atribuir/remover roles `user` e `admin` do catálogo seed
- **Proibido** remover `admin` de si mesmo se for o **único** admin restante
- Alvo inexistente ou fora do escopo → 404
- Alteração grava em `user_roles` — sem sync em Better Auth `user` table

UI de gestão (listar usuários, promover/rebaixar): SPEC dedicada ou seção em SPEC-0002 — fora desta ADR.

### Escopo de dados (admin)

Role `admin` concede `admin:access` à área `/admin/*`, mas **não** amplia `user_id` nas queries. Admin vê providers, logs e config **da própria sessão** — igual ADR-0009.

Cross-tenant / superadmin: **fora v1** — exige ADR nova.

### v1 vs expansão futura

| Capacidade | v1 |
|------------|-----|
| Roles no catálogo | Fixas (`user`, `admin`) — seed migration |
| Permissions no catálogo | Fixas (`app:use`, `admin:access`) — seed migration |
| UI criar role/permissão nova | **Não** — migration ou spec futura |
| Atribuir role existente a usuário | **Sim** — `set-user-role` |
| Múltiplas roles por usuário | **Sim** (schema) — v1 na prática `user` ± `admin` |

## Consequências

- SPEC-0001 ganha tabelas RBAC + seed na migration inicial
- SPEC-0000 pode referenciar hook de bootstrap; comportamento de guard permanece
- ADR-0009 **superseded** — não usar `ADMIN_EMAILS` como guard runtime
- Testes: fixtures de `user_roles` + mock `getUserPermissions`
- **Proibido:** checar email contra env em `requireAdminSession`; role só no client; bypass de `user_id` por ser admin; CRUD de catálogo role/permission sem spec

## Confirmação

```bash
test -f src/lib/rbac.ts
test -d src/db/queries/rbac.ts || test -f src/db/queries/roles.ts
grep -rq 'user_roles\|role_permissions' src/db/schema.ts
! grep -rq 'ADMIN_EMAILS' src/functions/auth/require-admin 2>/dev/null
grep -rq 'admin:access' src/lib/rbac.ts src/functions/auth/ 2>/dev/null
npm run typecheck
```

## Notas

Auth: ADR-0004. Schema: SPEC-0001. Admin UI: SPEC-0002. Substitui: ADR-0009.

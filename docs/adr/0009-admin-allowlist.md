---
status: superseded
date: 2026-06-17
builds-on: [ADR-0004]
superseded-by: ADR-0010
deciders: []
---

> ⚠️ VERDADE ATUAL: guard de admin e atribuição persistente → **ADR-0010** (RBAC D1). `ADMIN_EMAILS` permanece só como **bootstrap no signup**. Esta ADR não governa `requireAdminSession`.

# Restringir `/admin/*` a allowlist de emails

## Contexto e problema

Área `/admin/*` expõe config de providers/modelos, logs LLM/R2 e benchmark. Todo usuário autenticado (`@ifsc.edu.br`) **não** deve acessar — são ferramentas operacionais e dados sensíveis (keys criptografadas, trilha de auditoria).

## Direcionadores da decisão

- v1 sem roles no Better Auth — allowlist simples por email
- Mesmo padrão mental da allowlist de signup (env, lowercase)
- Falha opaca para não autenticados **e** não-admin (404, não 403)
- Admin vê **apenas** dados da própria sessão (`user_id`) — não super-user cross-tenant

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| `ADMIN_EMAILS` env (comma-separated) | **Escolhida** |
| Qualquer autenticado | Rejeitado |
| Role `admin` no Better Auth | Overkill v1 |
| Super-user vê todos os `user_id` | Rejeitado — fora do escopo multi-tenant |

## Decisão

| Peça | Implementação |
|------|----------------|
| Env | `ADMIN_EMAILS` — lista separada por vírgula, trim + lowercase |
| Guard server | `requireAdminSession()` em `src/functions/auth/` — sessão + email na lista |
| Guard rotas | `beforeLoad` em `src/routes/admin.*` — falha → **404** |
| Guard API admin | rotas `/api/admin/*` (se existirem) — mesmo guard → **404** |
| UX | Usuário comum não vê links admin na nav (opcional); URL direta → 404 |

Exemplo: `ADMIN_EMAILS=admin@ifsc.edu.br,ops@ifsc.edu.br`

**Escopo de dados:** admin autenticado opera só com `session.user.id` — logs, providers e config são **do próprio usuário**, não globais.

## Consequências

- Novo admin = editar env + redeploy (ou secret store futuro)
- Email fora da lista com sessão válida em `/admin/config` → **404**
- Testes: mock `requireAdminSession` ou env de test com email fixture
- **Proibido:** `/admin/*` sem guard; 403 revelando existência da rota; painel admin cross-user sem ADR nova

## Confirmação

```bash
test -f src/functions/auth/require-admin-session.ts || test -f src/functions/auth/require-admin.ts
grep -rq 'ADMIN_EMAILS' src/ wrangler.jsonc 2>/dev/null
npm run typecheck
```

## Notas

Auth base: ADR-0004. Specs: SPEC-0002 (config), SPEC-0012 (logs admin).

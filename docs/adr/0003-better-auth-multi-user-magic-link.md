---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0002]
deciders: []
---

# Usar Better Auth com multi-usuário e magic link

## Contexto e problema

App **multi-usuário**: cada conta isola exames, questões, tentativas, chat e config IA. Login obrigatório antes de rotas de app. v1: **magic link** (sem senha).

## Direcionadores da decisão

- Sessões httpOnly (cookie)
- Auth + domínio no mesmo D1 (Drizzle)
- Signup restrito a domínios de email institucionais
- Magic link enviado via **Resend** (HTTP API no Worker)
- Expansão futura: OAuth / email+senha (mesma lib)

## Opções consideradas

| Opção                                       | Veredito                                                       |
| ------------------------------------------- | -------------------------------------------------------------- |
| Better Auth + magic link + Drizzle + Resend | **Escolhida**                                                  |
| Cloudflare Email Sending                    | Mesmo vendor, mas Resend já operacional para `gugacarbo.space` |
| Cloudflare Access                           | Não isola `user_id` no D1                                      |
| Clerk                                       | SaaS externo                                                   |

## Decisão

**Better Auth** (`better-auth`):

| Peça     | Implementação                                                                           |
| -------- | --------------------------------------------------------------------------------------- |
| DB       | `drizzleAdapter(getDB(), { provider: "sqlite" })`                                       |
| Login v1 | Plugin `magicLink({ sendMagicLink })` → **Resend** `POST https://api.resend.com/emails` |
| API auth | `/api/auth/*` → `auth.handler(request)`                                                 |
| Factory  | `createAuth(env)` em `src/lib/auth.ts`                                                  |
| Client   | `better-auth/react` (`authClient`)                                                      |
| Guards   | `beforeLoad` no root: sem sessão → `/login`                                             |
| Server   | `getSession` / `requireSession` em `src/functions/auth/`; sem sessão → 401              |

**Signup (v1):** aberto apenas para `*@aluno.ifsc.edu.br`. Validação server-side obrigatória; env `ALLOWED_SIGNUP_EMAIL_DOMAINS=aluno.ifsc.edu.br`.

**Email transacional (v1):**

| Config   | Valor                                                |
| -------- | ---------------------------------------------------- |
| Provedor | Resend                                               |
| `from`   | `noreply@gugacarbo.space`                            |
| Secret   | `RESEND_API_KEY` (`wrangler secret`)                 |
| Dev      | logar magic link no console (sem Resend obrigatório) |

**Isolamento:** queries filtram `session.user.id`. Recurso de outro usuário → **404**.

**Autorização:** roles e permissões em D1 — ADR-0004. Better Auth não armazena role de admin.

**Secrets:** `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `BETTER_AUTH_URL` (origin pública do app).

## Consequências

- Domínio `gugacarbo.space` verificado no Resend para envio
- Usuários precisam de email `@aluno.ifsc.edu.br`
- Testes: mock `getSession` / Resend fetch
- **Proibido:** rotas de app sem sessão; omitir `user_id`; Cloudflare `EMAIL` binding para auth (Resend é o canal)

## Confirmação

```bash
test -f src/lib/auth.ts || test -f src/lib/auth/index.ts
grep -q 'better-auth' package.json
grep -rq 'resend\|api.resend.com' src/lib/ 2>/dev/null
npm run typecheck
```

## Notas

Fluxo e contrato: SPEC-0000. Schema: SPEC-0001.

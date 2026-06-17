---
status: accepted
date: 2026-06-17
builds-on: [ADR-0001, ADR-0002]
deciders: []
---

# Usar Better Auth com multi-usuário e magic link

## Contexto e problema

App **multi-usuário**: cada conta isola exames, questões, tentativas, chat e config IA. Login obrigatório antes de rotas de app. v1: entrada por **magic link** (sem senha).

## Direcionadores da decisão

- Sessões httpOnly (cookie), não JWT em localStorage
- Auth e domínio no mesmo D1 (Drizzle)
- Expansão futura: OAuth / email+senha via plugins da mesma lib
- Workers: factory `createAuth(env)` com binding D1

## Opções consideradas

| Opção | Veredito |
|-------|----------|
| Better Auth + magic link + Drizzle | **Escolhida** |
| Cloudflare Access | Não isola `user_id` no D1 |
| Clerk | SaaS externo; identidade fora do D1 |

## Decisão

**Better Auth** (`better-auth`):

| Peça | Implementação |
|------|----------------|
| DB | `drizzleAdapter(getDB(), { provider: "sqlite" })`; schema via `npx auth generate --adapter drizzle` |
| v1 login | Plugin `magicLink({ sendMagicLink })` — email via Resend ou Cloudflare Email |
| API | `/api/auth/*` → `auth.handler(request)` |
| Factory | `createAuth(env)` em `src/lib/auth.ts` |
| Client | `better-auth/react` (`authClient`) |
| Guards | `beforeLoad` no root: sem sessão → `/login` |
| Server | `auth.api.getSession({ headers })` em toda server fn e API route; sem sessão → 401 |

**Isolamento:** toda query/mutation filtra por `session.user.id`. Recurso de outro usuário → 404 ou 403 (definir em spec).

**Signup:** aberto vs convite-only → SPEC-0000 (`## Questões em aberto`).

**Expansão (pós-v1):** plugins `google`, `github`, `emailAndPassword`.

Secrets: `BETTER_AUTH_SECRET`, credenciais de email → `wrangler secret`.

## Consequências

- Dev local: logar link no console ou Mailpit
- Testes: mock `getSession` ou `createTestSession`
- **Proibido:** rotas de app sem sessão (exceto `/login`, `/api/auth/*`, assets); omitir `user_id` em queries

## Confirmação

```bash
test -f src/lib/auth.ts || test -f src/lib/auth/index.ts
grep -q 'better-auth' package.json
npm run typecheck
```

## Notas

Fluxo observável: SPEC-0000. Schema `user` + `user_id`: SPEC-0001.

---
status: accepted
date: 2026-06-17
builds-on: [ADR-0004, ADR-0010]
implemented-by: []
---

# Login por magic link e sessão protegida

> Convenções compartilhadas: `docs/context/CONVENTIONS.md`. Autorização em `src/functions/` segue esta spec.

## Objetivo

Usuário autenticado acessa o app com email + magic link. Sem sessão válida, não há acesso a rotas de app nem a functions de domínio. Cada usuário vê apenas os próprios dados (`user_id` da sessão).

**Signup:** aberto apenas para `*@ifsc.edu.br`.

## Fluxo

### Login (magic link)

1. Usuário abre `/login` e informa email.
2. Client valida formato; servidor valida domínio allowlist **antes** de emitir link.
3. Client chama `authClient.signIn.magicLink({ email, callbackURL })`.
4. Servidor cria token e chama `sendMagicLink`.
5. Usuário recebe email (prod) ou vê link no console (dev).
6. Clique no link → sessão → cookie httpOnly → redirect `callbackURL` (default `/`).

### Primeiro acesso (signup)

1. Mesmo fluxo do login; Better Auth cria `user` se email não existir e domínio permitido.
2. Hook pós-criação (`databaseHooks.user.create.after`): atribuir role `user` em `user_roles`; se email ∈ `ADMIN_EMAILS` → atribuir também role `admin` (ADR-0010).
3. Novo usuário entra com conta vazia.

### Navegação autenticada

1. `beforeLoad` no root verifica sessão.
2. Sem sessão em rota protegida → `/login?redirect=<pathname>`.
3. Com sessão em `/login` → `/`.

### Logout

1. `authClient.signOut()` → invalida sessão D1 + cookie.
2. Redirect `/login`.

### Server

1. `session = await auth.api.getSession({ headers })`.
2. Sem sessão → 401.
3. Com sessão → `userId = session.user.id` em todas as queries.

## Contrato

### Rotas públicas

| Rota | Método |
|------|--------|
| `/login` | GET |
| `/api/auth/*` | GET, POST |
| Assets estáticos | GET |

Demais rotas de página e `/api/*` (exceto auth) exigem sessão.

### Implementação

| Peça | Path |
|------|------|
| Factory | `src/lib/auth.ts` — `createAuth(env)` |
| Client | `src/lib/auth-client.ts` — `authClient` |
| Rota | `src/routes/api/auth/$.ts` → `auth.handler(request)` |
| Domínio | `src/lib/auth-allowed-email-domain.ts` — validação allowlist |
| RBAC bootstrap | `src/lib/rbac-bootstrap.ts` — roles no signup (ADR-0010) |

### Allowlist de domínio (signup/login)

- v1: `ALLOWED_SIGNUP_EMAIL_DOMAINS=ifsc.edu.br`
- Comparação: parte após `@`, trim + lowercase
- Email fora da lista: não enviar magic link; UI “Este email não está autorizado”
- Validação servidor (obrigatória) + client (UX)

### Plugin magic link

```ts
magicLink({
  sendMagicLink: async ({ email, url }) => { /* Resend ou console */ },
  expiresIn: 600,
})
```

### Email (Resend)

| Ambiente | Canal |
|----------|--------|
| `development` | `console.log('[auth] magic link', email, url)` |
| `production` | **Resend** — `POST https://api.resend.com/emails` |

Config v1:

| Variável | Valor |
|----------|--------|
| `EMAIL_FROM_ADDRESS` | `noreply@gugacarbo.space` |
| `EMAIL_FROM_NAME` | `Study App` (ou env) |
| `ALLOWED_SIGNUP_EMAIL_DOMAINS` | `ifsc.edu.br` |
| `RESEND_API_KEY` | secret (`wrangler secret put`) |

Prod — `sendMagicLink`:

```ts
await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
    to: [email],
    subject: "Seu link de acesso — Study App",
    text: `Acesse: ${url}`,
    html: `…`,
  }),
});
```

Pré-requisito prod: domínio `gugacarbo.space` verificado no Resend. Detalhe → `docs/context/INFRA.md`.

Secrets/vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, vars acima.

### Respostas de erro

| Situação | Resposta |
|----------|----------|
| Sem sessão (API) | 401 |
| Sem sessão (página) | 302 → `/login?redirect=…` |
| Recurso de outro usuário | **404** |
| Magic link inválido/expirado | `/login` + mensagem |
| Email domínio não permitido | 400 / mensagem inline; sem envio de link |
| Rate limit | 429 |

### UI `/login`

- Campo email, botão “Enviar link”, estados loading/sucesso/erro
- Sem senha na v1
- Copy: informar que só emails `@ifsc.edu.br` são aceitos

## Casos de borda

| # | QUANDO ⟨gatilho⟩ | o sistema DEVE ⟨resposta⟩ |
|---|---|---|
| 1 | não autenticado acessa `/exams` | redirect `/login?redirect=…` |
| 2 | autenticado acessa `/login` | redirect `/` |
| 3 | magic link válido | criar sessão; redirect `callbackURL` |
| 4 | magic link expirado/usado | erro em `/login`; sem sessão |
| 5 | server function sem cookie | 401 |
| 6 | user A acessa recurso de user B | **404** |
| 7 | email formato inválido | validação; sem envio |
| 8 | email `user@gmail.com` | rejeitar; sem magic link |
| 9 | email `user@ifsc.edu.br` | permitir signup/login |
| 10 | email `User@ifsc.edu.br` | aceitar (domínio case-insensitive) |
| 11 | logout | invalidar sessão; requests seguintes sem cookie |
| 12 | dev sem `RESEND_API_KEY` | login via link no console |
| 13 | novo link antes do anterior expirar | comportamento default Better Auth |
| 14 | signup `user@ifsc.edu.br` em `ADMIN_EMAILS` | roles `user` + `admin` |
| 15 | signup email comum `@ifsc.edu.br` | só role `user` |

## Questões em aberto

(nenhuma)

## Definition of Done

```bash
npm run typecheck                                                                    # exit 0
npm test -- src/lib/auth.test.ts src/lib/auth-allowed-email-domain.test.ts           # verdes
npm test -- src/lib/rbac-bootstrap.test.ts src/routes/login.spec.tsx src/functions/auth/require-session.test.ts     # verdes
```

Fechamento manual: login E2E dev (console); `/exams` bloqueada sem sessão; domínio errado rejeitado.

## Revisão humana

- Domínio `gugacarbo.space` verificado no Resend
- `BETTER_AUTH_URL` = URL pública do Worker
- `RESEND_API_KEY` em secret de produção

## Verificação

```text
(preencher no fechamento)
```

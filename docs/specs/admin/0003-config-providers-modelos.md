---
status: accepted
date: 2026-06-17
builds-on: [ADR-0007, ADR-0003, ADR-0006, ADR-0004]
implemented-by: []
---

# Admin: providers, modelos e roles

> Convenções: `docs/context/CONVENTIONS.md` · Schema `ai_providers` / `ai_models` / `config`: SPEC-0001 · Criptografia: ADR-0006 · RBAC: ADR-0004

## Objetivo

Administrador (`admin:access`) configura providers de IA, catálogo de modelos e modelo padrão **da própria conta** (`user_id` da sessão). API keys nunca saem do servidor em texto claro. Admin também atribui roles `user` / `admin` a outros usuários via `setUserRole`.

Sem `admin:access`, rotas `/admin/*` respondem **404** (não 403).

## Fluxo

### Acesso à área admin

1. Usuário autenticado navega para `/admin` ou subrota.
2. `beforeLoad` chama guard servidor (`requireAdminSession`).
3. Sem `admin:access` → **404** (página inexistente).
4. Com permissão → render da rota.

### CRUD de provider

1. Admin abre `/admin/config`.
2. UI lista providers do `user_id` da sessão (API key **mascarada** — nunca plaintext).
3. Criar/editar: `name`, `baseUrl`, `apiKey` (obrigatória no create; no update, vazio = manter atual), `enabled`.
4. Servidor valida Zod + ownership; `api_key` persiste via `encryptSecret` (ADR-0006).
5. Delete provider → cascade em `ai_models`; se algum modelo era default, limpar `config.default_ai_model_id`.

### CRUD de modelo

1. Admin seleciona provider e gerencia modelos filhos.
2. Campos v1: `modelId` (id no provider), `displayName`, `enabled`; opcionais: `contextWindow`, `maxOutputTokens`, custos, thinking (`thinking_*`, `requestParams` JSON).
3. `modelId` único por `(provider_id, model_id)` — constraint D1.
4. Ownership: `ai_models.provider_id` → `ai_providers.user_id` = sessão.

### Descoberta de modelos (opcional na UI)

1. Admin clica “Importar do provider” em provider habilitado.
2. Server function chama endpoint OpenAI-compatível `GET {baseUrl}/models` com key descriptografada **só no servidor**.
3. Retorna lista sugerida; admin confirma quais inserir/atualizar (sem auto-delete de modelos existentes).

### Modelo padrão

1. Admin escolhe um `ai_models.id` habilitado cujo provider também está habilitado.
2. Upsert em `config`: `key = default_ai_model_id`, `value = <uuid>`.
3. `getAiModel()` (servidor) resolve default quando caller não passa `modelId` explícito.

### Teste de conexão

1. Admin testa provider (novo ou existente).
2. Server tenta `GET {baseUrl}/models` (ou HEAD mínimo se provider não suportar list).
3. Sucesso → `{ ok: true }`; falha → `{ ok: false, error: string }` (sem vazar key).

### Atribuição de role (`setUserRole`)

1. Admin abre `/admin/users`.
2. Lista usuários (email, roles atuais).
3. Promover/rebaixar: adicionar ou remover role `user` ou `admin` do catálogo seed.
4. Caller precisa `admin:access`.
5. **Proibido** remover `admin` de si mesmo se for o **único** admin restante.
6. Alvo inexistente → **404**.

### Resolução de modelo (servidor — consumido por specs de IA)

1. Feature de IA chama `getAiModel({ userId, modelId? })` em `src/lib/ai-config.ts`.
2. Carrega provider + model de D1; descriptografa key; instancia provider Vercel AI SDK (`@ai-sdk/openai` + `baseURL` custom na v1).
3. Provider/model desabilitados ou inexistentes → erro descritivo (não expor key).

## Contrato

### Rotas (páginas)

| Rota            | Guard              | Conteúdo v1                          |
| --------------- | ------------------ | ------------------------------------ |
| `/admin`        | `admin:access`     | Hub ou redirect → `/admin/config`    |
| `/admin/config` | `admin:access`     | Providers, modelos, default          |
| `/admin/users`  | `admin:access`     | Listagem + `setUserRole`             |

Demais rotas `/admin/*` futuras seguem o mesmo guard.

### Tabela `config` (chaves v1)

| `key`                  | `value`              | Regra                                      |
| ---------------------- | -------------------- | ------------------------------------------ |
| `default_ai_model_id`  | UUID `ai_models.id`  | Modelo e provider devem existir, pertencer ao `user_id` e estar `enabled` |

### API / server functions (v1)

Todas exigem `requireAdminSession` (exceto `getAiModel`, usado internamente com `userId` de sessão de job).

| Operação            | Entrada principal                                      | Saída / efeito                                      |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `listProviders`     | —                                                      | Providers sem key; `apiKeyMasked`, `hasApiKey`      |
| `createProvider`    | `name`, `baseUrl`, `apiKey`, `enabled?`                | `{ id }`                                            |
| `updateProvider`    | `id`, campos parciais (`apiKey` omitido = manter)      | `{ id }`                                            |
| `deleteProvider`    | `id`                                                   | void; limpa default se necessário                   |
| `testProvider`      | `id` ou payload de create (dry-run)                    | `{ ok, error? }`                                    |
| `discoverModels`    | `providerId`                                           | `{ models: [...] }` sugestões                       |
| `listModels`        | `providerId`                                           | Modelos do provider (ownership validado)            |
| `upsertModel`       | `providerId`, `modelId`, `displayName`, …              | `{ id }`                                            |
| `deleteModel`       | `id`                                                   | void; limpa default se necessário                   |
| `setDefaultModel`   | `modelId` \| `null`                                    | void                                                |
| `getAdminAiConfig`  | —                                                      | Snapshot para UI (providers, models, default)       |
| `listUsers`         | —                                                      | `{ id, email, roles[] }`                            |
| `setUserRole`       | `userId`, `roleKey`, `action: add \| remove`           | void                                                |

Validação Zod em todas; URLs válidas; strings trimadas; `baseUrl` sem trailing slash redundante (normalizar no servidor).

### Criptografia (ADR-0006)

| Momento        | Comportamento                                                |
| -------------- | ------------------------------------------------------------ |
| Insert/update  | `encryptSecret(apiKey)` antes do `INSERT`/`UPDATE`           |
| Leitura servidor | `decryptSecret` só em `ai-config.ts` / test / discover   |
| Resposta API   | **Nunca** `api_key` plaintext; usar `maskApiKey` (`••••` + últimos 4) |

`CONFIG_ENCRYPTION_KEY` ausente em runtime de mutação → **500** com mensagem clara (não gravar plaintext).

### Implementação

| Peça              | Path                                                              |
| ----------------- | ----------------------------------------------------------------- |
| Criptografia      | `src/lib/config-encryption.ts`                                    |
| Resolução IA      | `src/lib/ai-config.ts` — `getAiModel`, `maskApiKey`               |
| Queries providers | `src/db/queries/ai-providers.ts`                                  |
| Queries models    | `src/db/queries/ai-models.ts`                                     |
| Queries config    | `src/db/queries/config.ts`                                        |
| Queries users     | `src/db/queries/users.ts` (listagem admin)                        |
| Functions admin   | `src/functions/admin/` — providers, models, config, users, roles  |
| UI                | `src/features/admin/`                                             |
| Rotas             | `src/routes/admin/index.tsx`, `config/index.tsx`, `users/index.tsx` |
| Guard             | `src/lib/rbac.ts` — `requireAdminSession` (já existe)           |

### Resposta de erro

| Situação                         | HTTP / throw        |
| -------------------------------- | ------------------- |
| Sem sessão                       | 401                 |
| Sem `admin:access` em rota admin | 404                 |
| Recurso de outro `user_id`       | 404                 |
| Validação Zod                    | 400                 |
| Único admin removendo próprio admin | 400              |
| `CONFIG_ENCRYPTION_KEY` inválida | 500                 |

## Casos de borda

| #   | QUANDO ⟨gatilho⟩                                      | o sistema DEVE ⟨resposta⟩                              |
| --- | ----------------------------------------------------- | ------------------------------------------------------ |
| 1   | update provider sem `apiKey` no payload               | manter ciphertext existente                            |
| 2   | delete provider com modelos                           | cascade D1; limpar `default_ai_model_id` se afetado    |
| 3   | delete modelo que é default                           | remover entrada `default_ai_model_id`                  |
| 4   | `setDefaultModel` com model/provider `enabled = false`| rejeitar (400)                                         |
| 5   | `discoverModels` com provider desabilitado            | rejeitar (400)                                         |
| 6   | provider test com `baseUrl` inválido                  | `{ ok: false, error }` sem throw                       |
| 7   | usuário não-admin acessa `/admin/config`              | **404**                                                |
| 8   | `setUserRole` com `roleKey` fora do seed              | rejeitar (400)                                         |
| 9   | último admin tenta `remove admin` de si                 | rejeitar (400)                                         |
| 10  | `getAiModel` sem default configurado                  | erro claro “nenhum modelo padrão”                      |
| 11  | plaintext legado em `api_key` (pré-migração)          | `decryptSecret` aceita; re-save criptografa            |

## Questões em aberto

(nenhuma)

## Definition of Done

```bash
npm run typecheck
npm test -- src/lib/config-encryption.test.ts
npm test -- src/lib/ai-config.test.ts
npm test -- src/db/queries/ai-providers.test.ts
npm test -- src/db/queries/ai-models.test.ts
npm test -- src/db/queries/config.test.ts
npm test -- src/functions/admin/
test -f src/routes/admin/config/index.tsx
grep -rq 'requireAdminSession' src/routes/admin/
grep -rq 'encryptSecret' src/functions/admin/
! grep -rE 'apiKey.*:.*input\.apiKey' src/routes/admin/ src/features/admin/ 2>/dev/null
npm run docs-check
```

## Revisão humana

- Confirmar `CONFIG_ENCRYPTION_KEY` em prod (`wrangler secret put`)
- Smoke manual: criar provider OpenAI-compatível, importar modelos, definir default, promover usuário a admin

## Verificação

```text
(preencher no fechamento)
```

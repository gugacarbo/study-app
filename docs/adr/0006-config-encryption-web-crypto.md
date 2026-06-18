---
status: accepted
date: 2026-06-17
builds-on: [ADR-0002]
deciders: []
---

# Criptografar secrets de config com Web Crypto AES-GCM

## Contexto e problema

API keys de providers IA ficam em D1 (`ai_providers.api_key`). Texto plano no banco é inaceitável se o binding D1 vazar ou um dump for exportado. Workers não têm filesystem para KMS local — precisa de criptografia simétrica no runtime com secret de deploy.

## Direcionadores da decisão

- Compatível com **Web Crypto** (`crypto.subtle`) em Workers
- Sem serviço externo de KMS na v1
- Rotação de chave exige re-encrypt manual (aceitável v1)
- Mesmo padrão testável do legado (`.old_app/src/lib/config-encryption.ts`)

## Opções consideradas

| Opção                                                   | Veredito                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| AES-GCM 256 + `CONFIG_ENCRYPTION_KEY` (base64 32 bytes) | **Escolhida**                                              |
| Texto plano em D1                                       | Rejeitado                                                  |
| Hash one-way (bcrypt)                                   | Rejeitado — keys precisam ser recuperáveis para chamar LLM |
| Cloudflare Secrets Store / external KMS                 | Overkill v1                                                |

## Decisão

**Web Crypto AES-GCM** em `src/lib/config-encryption.ts`:

| Peça               | Valor                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Algoritmo          | `AES-GCM`                                                                                        |
| IV                 | 12 bytes aleatórios por encrypt                                                                  |
| Chave              | `CONFIG_ENCRYPTION_KEY` — base64 que decodifica para **exatamente 32 bytes**                     |
| Formato armazenado | `enc:v1:{iv_b64}:{ciphertext_b64}`                                                               |
| API pública        | `encryptSecret`, `decryptSecret`, `isEncryptedSecret`                                            |
| Uso                | `encryptApiKeyForStorage` / leitura em `src/lib/ai-config.ts` antes de `getAiModel()` (ADR-0007) |

Secret: `CONFIG_ENCRYPTION_KEY` via `wrangler secret` (prod) e `.dev.vars` (local). Gerar: `openssl rand -base64 32`.

`decryptSecret` aceita valor legado sem prefixo (plaintext) para migração pontual — novos inserts **sempre** criptografados.

## Consequências

- Perda de `CONFIG_ENCRYPTION_KEY` = keys irrecuperáveis — usuário reconfigura providers
- Rotação: script/admin futuro re-encrypt; não automático na v1
- Testes usam chave fixa em env de test — nunca commitar chave real
- **Proibido:** API key em plaintext no insert de `ai_providers`; logar key descriptografada; enviar key ao client

## Confirmação

```bash
test -f src/lib/config-encryption.ts
grep -rq 'encryptSecret\|decryptSecret' src/lib/ai-config.ts src/functions/ 2>/dev/null
! grep -rE 'api_key.*=.*sk-' src/db/ src/functions/ 2>/dev/null
npm run typecheck
```

## Notas

UI de providers: SPEC-0002. Stack IA: ADR-0007.

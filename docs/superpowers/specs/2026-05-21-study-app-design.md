# Study App — Design Spec

**Date**: 2026-05-21
**Status**: Draft — awaiting review

---

## 1. Overview

Single-user web app para estudar para provas da faculdade usando provas anteriores como base. Upload de PDFs, extração de questões via IA, quiz interativo, tracking de progresso.

### Stack

- **Framework**: TanStack Start (SPA, sem SSR)
- **Runtime**: Cloudflare Workers (local via `wrangler dev`)
- **Database**: Cloudflare D1 (SQLite-compatible)
- **AI**: TanStack AI + `@openrouter/sdk` (multi-provider)
- **Deploy**: Cloudflare Pages + Workers

### TanStack Libraries (todas incluídas)

| Library          | Uso                                               |
| ---------------- | ------------------------------------------------- |
| TanStack Start   | Fullstack framework, server functions             |
| TanStack Router  | Routing client-side                               |
| TanStack AI      | Chamadas de IA com type safety                    |
| TanStack Query   | Server state management                           |
| TanStack Form    | Upload, config, quiz forms                        |
| TanStack Store   | Estado local (quiz ativo, UI state)               |
| TanStack DB      | D1 queries tipadas                                |
| TanStack Table   | Histórico de tentativas, stats                    |
| TanStack Hotkeys | Atalhos no quiz (1-4, Enter, Esc)                 |
| TanStack Virtual | Listas longas de questões                         |
| TanStack CLI     | Scaffolding e dev tooling                         |
| TanStack Intent  | AI-assisted dev skills (dev tooling, não runtime) |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Pages                    │
│  ┌───────────────────────────────────────────────┐  │
│  │              TanStack Start SPA                │  │
│  │  ┌─────────┐ ┌────────┐ ┌──────┐ ┌─────────┐  │  │
│  │  │  Router │ │ Query  │ │ Form │ │  Store  │  │  │
│  │  └────┬────┘ └───┬────┘ └──┬───┘ └────┬────┘  │  │
│  │       │          │         │          │        │  │
│  │  ┌────▼──────────▼─────────▼──────────▼────┐   │  │
│  │  │           React UI Components            │   │  │
│  │  │  (Dashboard, Quiz, Upload, Stats, Config)│   │  │
│  │  └────────────────────┬─────────────────────┘   │  │
│  │                       │                          │  │
│  │  ┌────────────────────▼─────────────────────┐   │  │
│  │  │        TanStack Hotkeys + Virtual         │   │  │
│  │  └──────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────┬────────────────────────────────┘
                       │ Server Functions (RPC)
┌──────────────────────▼────────────────────────────────┐
│               Cloudflare Worker (API)                  │
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  TanStack AI     │  │  @openrouter/sdk          │   │
│  │  (chat, tools)   │  │  (multi-provider routing) │   │
│  └────────┬─────────┘  └────────────┬─────────────┘   │
│           │                         │                  │
│  ┌────────▼─────────────────────────▼──────────────┐  │
│  │           Server Functions Layer                 │  │
│  │  ingestExam()  generateQuiz()  submitAnswer()   │  │
│  │  getConfig()   getStats()    getProgress()      │  │
│  └────────────────────────┬────────────────────────┘  │
│                           │                            │
│  ┌────────────────────────▼────────────────────────┐  │
│  │              TanStack DB + D1                    │  │
│  │  questions  attempts  exams  topics  config     │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### Project Structure

```
study-app/
├── app/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── Quiz.tsx
│   │   ├── UploadForm.tsx
│   │   ├── StatsTable.tsx
│   │   └── ConfigForm.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx              # Dashboard
│   │   ├── upload.tsx
│   │   ├── quiz.$id.tsx
│   │   ├── stats.tsx
│   │   └── config.tsx
│   ├── server-functions/
│   │   ├── ingest.ts
│   │   ├── quiz.ts
│   │   ├── stats.ts
│   │   └── config.ts
│   ├── db/
│   │   ├── schema.ts
│   │   └── queries.ts
│   ├── lib/
│   │   ├── ai.ts                  # TanStack AI + OpenRouter setup
│   │   ├── parser.ts              # PDF parsing
│   │   └── validation.ts          # Zod schemas
│   ├── stores/
│   │   └── quizStore.ts           # TanStack Store
│   └── styles/
│       └── globals.css
├── migrations/
│   └── 001_initial.sql
├── wrangler.toml
├── app.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Components & Routes

### Pages/Routes

| Rota        | Componente | TanStack Libs         | Descrição                                        |
| ----------- | ---------- | --------------------- | ------------------------------------------------ |
| `/`         | Dashboard  | Query, Store, Table   | Visão geral: provas importadas, progresso, stats |
| `/upload`   | UploadPage | Form, Query           | Upload de PDFs, preview, ingest                  |
| `/quiz/:id` | QuizPage   | Hotkeys, Store, AI    | Modo quiz com questões, hotkeys, explicações     |
| `/stats`    | StatsPage  | Table, Query, Virtual | Histórico detalhado, progresso por tema          |
| `/config`   | ConfigPage | Form, Store           | Provider, modelo, API key, preferências          |

### Server Functions

| Função                             | Input              | Output                                       | Descrição                                          |
| ---------------------------------- | ------------------ | -------------------------------------------- | -------------------------------------------------- |
| `ingestExam(file)`                 | PDF File           | `{ questions: number, topics: string[] }`    | Parse PDF, extrai questões via IA, salva no D1     |
| `generateQuiz(topic?, count?)`     | topic, count       | `Question[]`                                 | Gera questões novas ou busca existentes            |
| `submitAnswer(questionId, answer)` | id, answer         | `{ correct: boolean, explanation: string }`  | Valida resposta, salva attempt, retorna explicação |
| `getStats()`                       | —                  | `{ topics: TopicStats[], attempts: number }` | Retorna stats agregados                            |
| `getConfig()` / `setConfig(cfg)`   | — / ProviderConfig | ProviderConfig                               | Lê/salva config do provider                        |

---

## 4. Data Flow

### Upload → Ingest

```
User → Upload PDF
  → TanStack Form valida arquivo
  → Server function ingestExam()
    → PDF parsing (ver nota abaixo)
    → TanStack AI + OpenRouter: "Extraia questões deste texto"
    → TanStack DB salva questões no D1
    → TanStack Query invalida cache
  → Dashboard atualiza com nova prova
```

### Quiz Flow

```
User → Inicia Quiz
  → Server function generateQuiz()
  → TanStack Query cacheia questões
  → TanStack Store gerencia estado do quiz (questão atual, resposta)
  → TanStack Hotkeys mapeia teclas (1-4 para respostas, Enter para confirmar)
  → TanStack Virtual renderiza lista de questões (se muitas)

User → Responde questão
  → Server function submitAnswer()
  → TanStack DB registra attempt
  → Retorna { correct, explanation }
  → UI mostra feedback (verde/vermelho + explicação)
  → TanStack Query invalida stats
```

---

## 5. Database Schema (D1)

### Nota sobre TanStack DB

TanStack DB é novo e pode não ter adapter D1 pronto. Implementação:

- Usar D1 bindings diretamente via `env.DB.prepare()` nas server functions
- Manter TanStack DB como dependency, integrar quando adapter estiver disponível
- Schema SQL definido em `migrations/` para controle direto

```sql
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER REFERENCES exams(id),
  question TEXT NOT NULL,
  options TEXT NOT NULL,  -- JSON array
  answer TEXT NOT NULL,
  explanation TEXT,
  topic TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER REFERENCES questions(id),
  user_answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 6. AI Integration

### PDF Parsing em Cloudflare Workers

`pdf-parse` (Node.js) não roda em Workers. Alternativas:

- **Local dev**: `pdf-parse` via Node.js compatibility do Wrangler
- **Workers prod**: Enviar PDF como base64 para IA com vision model (GPT-4o, Claude) que extrai texto diretamente
- **Fallback**: User cola texto manualmente se parsing falhar

### Provider Config

```ts
interface ProviderConfig {
  provider: "openrouter" | "openai" | "groq" | "ollama" | "custom";
  model: string;
  baseUrl?: string;
  apiKey: string;
}
```

### Server-side AI (nunca expõe keys no client)

- Todas as chamadas de IA rodam em server functions
- `@openrouter/sdk` no servidor com `OPENROUTER_API_KEY` do env
- Model selection explícito e fácil de trocar
- Fallback para outros providers se um falhar

### AI Reliability

- JSON parsing: `response_format: { type: "json_object" }` quando disponível
- Schema validation: Zod para validar resposta da IA antes de salvar
- Retry automático (max 2) se JSON inválido
- Fallback manual: user pode colar questões se IA falhar

---

## 7. Error Handling

| Cenário                  | Comportamento                                          |
| ------------------------ | ------------------------------------------------------ |
| API key inválida         | Toast de erro no config, fallback para modo offline    |
| PDF não parseável        | Mensagem "Formato não suportado", sugere texto manual  |
| IA retorna JSON inválido | Retry automático (max 2), fallback manual              |
| D1 indisponível          | Fallback para Store em memória, sync depois            |
| Rate limit OpenRouter    | Queue + retry com backoff, aviso visual                |
| Network offline          | Modo offline: quiz com questões cacheadas, sync depois |

---

## 8. Testing

| Tipo        | Ferramenta            | Cobertura                             |
| ----------- | --------------------- | ------------------------------------- |
| Unit        | Vitest                | Server functions, parsing, DB queries |
| Integration | Vitest + wrangler dev | Server functions → D1 → AI mock       |
| E2E         | Playwright            | Fluxo completo: upload → quiz → stats |

---

## 9. Environment Variables

| Variable             | Descrição                            | Required |
| -------------------- | ------------------------------------ | -------- |
| `OPENROUTER_API_KEY` | API key do OpenRouter                | Sim      |
| `AI_PROVIDER`        | Provider padrão (`openrouter`)       | Não      |
| `AI_MODEL`           | Modelo padrão (`openai/gpt-4o-mini`) | Não      |

---

## 10. Deploy Notes

### Local Dev

```bash
npm run dev          # TanStack Start dev server
wrangler dev         # D1 local
```

### Cloudflare Deploy

```bash
wrangler deploy      # Worker + D1
npx wrangler pages deploy dist  # Pages
```

### Migration Path

- SQLite local → D1 via `wrangler d1 execute`
- Migrations em `migrations/` directory
- `wrangler.toml` configura D1 binding

---

## 11. Next Steps

1. Scaffold com TanStack CLI: `npx @tanstack/cli@latest create study-app --agent --deployment cloudflare`
2. Instalar TanStack Intent: `npx @tanstack/intent@latest install`
3. Configurar D1 e wrangler.toml
4. Implementar schema DB e migrations
5. Implementar server functions (ingest, quiz, stats, config)
6. Implementar UI components e routes
7. Integrar TanStack AI + OpenRouter
8. Adicionar Hotkeys, Virtual, Table
9. Tests (unit, integration, E2E)
10. Deploy para Cloudflare

# Specs — layout e numeração

Extensão local do [CASA Standard](https://github.com/atplus-digital/casa-standard): o upstream exige `docs/specs/*.md` plano; este repo agrupa por domínio mantendo **numeração global única**.

## Onde colocar cada spec

| Tipo                 | Caminho                                     | Quando usar                                                      |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Global / transversal | `docs/specs/NNNN-titulo-kebab.md`           | Schema, infra, convenções que atravessam domínios                |
| Por domínio          | `docs/specs/{domínio}/NNNN-titulo-kebab.md` | Comportamento de um domínio (`auth`, `exams`, `quiz`, `chat`, …) |

Regras:

- **Um nível** de subpasta sob `docs/specs/` — sem `docs/specs/auth/nested/…`.
- Pasta de domínio em **kebab-case** (`auth`, `background-processes`, `admin`).
- Só `docs/specs/README.md` é índice gerado; não criar `README.md` em subpastas.
- ADRs continuam planos em `docs/adr/` (sem subpastas).

## Numeração global

O prefixo `NNNN` no filename define o id (`SPEC-NNNN`), **independente da pasta**.

- A sequência é **única no repo**: após `docs/specs/auth/0002-authentication.md`, a próxima spec (ex. UI) é `0003`, não `0000` na nova pasta.
- Números contíguos a partir de `0000` — sem buracos (`0000`, `0001`, `0002`, …).
- Reservas de numeração e ordem de implementação → `docs/BACKLOG.md`.

Exemplos (layout atual deste repo):

```
docs/specs/
  README.md
  0001-schema-migrations-clean-slate.md
  auth/
    0000-autenticacao-magic-link.md
  ui/
    0003-shell-navegacao.md          # próximo número global após 0002
```

## Frontmatter e corpo

Igual ao CASA: `status`, `date`, `builds-on`, `implemented-by`. Id e título são **derivados** (filename → `SPEC-NNNN`; primeiro H1 → título). Template → `docs/templates/spec.template.md`.

## Validação

```bash
npm run docs-check              # gate — falha se layout ou índices divergirem
npm run docs-check -- --emit-index   # regenera docs/specs/README.md e docs/index.json
```

O `scripts/docs-check` valida: filename `NNNN-kebab.md`, pastas de domínio, profundidade máxima, sequência global e links relativos no README.

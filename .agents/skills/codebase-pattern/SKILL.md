---
name: codebase-pattern
description: >-
  Establish, enforce, and update project-specific coding patterns. Use when
  writing, reviewing, or refactoring code — always check the patterns file
  first. Also use when the user asks to "set up coding standards", "create
  patterns file", "define conventions", "enforce code style", "standardize
  code", or mentions coding patterns, conventions, or style guides. Triggers on
  any task that involves writing or modifying code in a project that has a
  codebase-patterns reference in its AGENTS.md. Also triggers when the
  user runs /codebase-pattern to add, update, or query specific patterns.
user-invocable: true
argument-hint: "[add <pattern description> | setup | check | update]"
effort: low
---

# Codebase Pattern

Ensure consistent coding patterns across a project by creating, referencing,
and maintaining a centralized patterns file.

## Core Principle

Before writing or modifying code, always check if the project has a
codebase-patterns file. If it does, follow those patterns. If it doesn't,
offer to create one.

## Command Modes

| Command                               | Action                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `/codebase-pattern` (no args)         | Check for patterns file; if missing, offer setup; if present, show summary |
| `/codebase-pattern setup              | init`                                                                      | Create patterns file + AGENTS.md reference (Phase 2) |
| `/codebase-pattern add <description>` | Add a new pattern to the file (Phase 5)                                    |
| `/codebase-pattern check`             | Verify current code against patterns (Phase 3)                             |
| `/codebase-pattern update`            | Propose updates based on new patterns found in codebase (Phase 4)          |

---

## Phase 1: Locate Patterns File

1. Read the project's `AGENTS.md` (root or nearest parent)
2. Look for a `## Code Patterns` section with a file reference
   (default: `docs/codebase-patterns.md`)
3. If found → read the file, proceed to the appropriate phase
4. If not found → offer setup (Phase 2)

---

## Phase 2: Setup — Create Patterns File

### Step 1: Confirm location

Ask the user to confirm or customize the file path using `vscode_askQuestions`:

**Default:** `docs/codebase-patterns.md`

```json
{
  "questions": [{
    "header": "File path",
    "question": "Where should the patterns file be created?",
    "options": [
      { "label": "docs/codebase-patterns.md", "recommended": true },
      { "label": "docs/conventions.md" },
      { "label": ".patterns.md" },
      { "label": "CONVENTIONS.md" }
    ],
    "allowFreeformInput": true
  }]
}
```

### Step 2: Analyze the project

Scan the codebase to populate the file:

- **Config files:** tsconfig, biome, eslint, prettier, package.json scripts
- **Naming patterns:** file names, export names, directory structure
- **Import patterns:** alias usage, import ordering
- **Error handling:** try/catch patterns, error types
- **Testing patterns:** test file location, framework, mocking style
- **Anti-patterns:** search for `DO NOT`, `NEVER`, `ALWAYS`, `FIXME`, `HACK` in comments and existing AGENTS.md

### Step 3: Create the patterns file

Use the template from the **Patterns File Template** section (see references/template.md).

### Step 4: Add reference to AGENTS.md

Insert this section after the Overview:

```markdown
## Code Patterns
> **Always read before writing or reviewing code:**
> [`docs/codebase-patterns.md`](docs/codebase-patterns.md)
```

If AGENTS.md doesn't exist, create it with at least the patterns reference and a brief project description.

### Step 5: Confirm

Show the user the created file and the AGENTS.md diff for review.

---

## Phase 3: Enforcement — Follow Patterns

When writing or modifying code:

1. **Read the patterns file** at the start of any coding task
2. **Apply the patterns** — naming, imports, exports, error handling, etc.
3. **If a pattern doesn't cover the case**, make a decision consistent with existing patterns and suggest adding it (`/codebase-pattern add ...`)
4. **Never silently deviate** — if you must break a pattern, explain why

---

## Phase 4: Update — Keep Patterns Current

When new patterns emerge organically in the codebase:

1. **Propose updates** to the patterns file when you notice:
   - A new consistent pattern across multiple files
   - A config change that affects conventions
   - A repeated deviation that should become the standard
2. **Add, don't replace** — new patterns augment the file; existing ones are only changed when explicitly requested

---

## Phase 5: Add Pattern — Interactive Insertion

This is the primary interactive flow. Triggered when the user runs:

```
/codebase-pattern add <description>
```

Or simply provides a pattern description after `/codebase-pattern`.

### Step 1: Parse the user's input

Extract what the user wants to add. Examples:

| User input                                       | Extracted intent                       |
| ------------------------------------------------ | -------------------------------------- |
| `add "use camelCase for server functions"`       | Naming convention for server functions |
| `Adicionar padrão de imports: externos primeiro` | Import ordering rule                   |
| `never use any, use unknown`                     | Anti-pattern rule                      |
| `componentes ficam em src/components/`           | File organization rule                 |
| `testes seguem espelho de src/`                  | Testing pattern                        |

### Step 2: Classify the pattern

Determine which section of the patterns file this belongs to:

| Section                | Triggers                                                  |
| ---------------------- | --------------------------------------------------------- |
| Naming Conventions     | File names, variable names, export names, directory names |
| Import Patterns        | Import order, alias usage, barrel exports                 |
| Export Patterns        | Default vs named exports, re-exports                      |
| Error Handling         | Try/catch, error types, logging, error display            |
| File Organization      | Where files go, directory structure                       |
| Testing Patterns       | Test location, framework, mocking, assertion style        |
| Anti-Patterns (Do Not) | Things to avoid, forbidden patterns                       |
| Project-Specific Rules | Rules unique to this stack/project                        |

If the classification is ambiguous, use `vscode_askQuestions` to resolve:

```json
{
  "questions": [{
    "header": "Section",
    "question": "Which section should this pattern go in?",
    "options": [
      { "label": "Naming Conventions" },
      { "label": "Import Patterns" },
      { "label": "Export Patterns" },
      { "label": "Error Handling" },
      { "label": "File Organization" },
      { "label": "Testing Patterns" },
      { "label": "Anti-Patterns (Do Not)" },
      { "label": "Project-Specific Rules" }
    ],
    "allowFreeformInput": true
  }]
}
```

### Step 3: Check for conflicts

Read the existing patterns file and verify:

1. **No direct contradiction** — e.g., adding "use camelCase files" when the file already says "use kebab-case files"
2. **No duplication** — e.g., the same rule already exists under different wording
3. **Consistent granularity** — the new entry should be at the same detail level as existing entries in the same section

If a conflict or duplication is found, use `vscode_askQuestions`:

```json
{
  "questions": [{
    "header": "Conflict",
    "question": "This pattern conflicts with an existing rule: '<existing_rule>'. What would you like to do?",
    "options": [
      { "label": "Replace the existing rule" },
      { "label": "Keep both (add as exception/nuance)" },
      { "label": "Cancel — I'll reconsider" }
    ]
  }]
}
```

### Step 4: Format the entry

Match the existing format of the target section:

**For table sections** (Naming, File Organization, etc.), add a row:

```markdown
| Server functions | camelCase | `getExamDetail` |
```

**For list sections** (Imports, Anti-patterns, etc.), add a bullet:

Negative rule:
```markdown
- ❌ Don't use `any` — use `unknown` + type guards
```

Positive rule:
```markdown
- Always validate input at the server function boundary using Zod schemas
```

**For Project-Specific Rules**, add a bullet with context:

```markdown
- AI calls are server-side only — never call OpenRouter from the browser
```

If the target section doesn't exist yet, create it using the section template from `references/template.md`.

### Step 5: Insert and confirm

1. Insert the formatted entry in the correct section
2. If the section doesn't exist yet, create it using the section template
3. Show the diff to the user for confirmation
4. If the user approves, save; if not, iterate on the wording

---

## Custom Path Support

If the user wants a different location:
- Accept any valid relative path (e.g., `.patterns.md`, `CONVENTIONS.md`, `docs/style-guide.md`)
- Update the AGENTS.md reference to point to the actual path
- Adjust the section header in the patterns file accordingly

---

## Interaction with init-deep

If `init-deep` has already generated AGENTS.md files:
- Read the existing AGENTS.md to understand project context
- Place the patterns reference in the root AGENTS.md
- Avoid duplicating information — the patterns file complements AGENTS.md, not replaces it
- If AGENTS.md already has a "Known Gotchas" or "Conventions" section, migrate those entries into the patterns file for better structure

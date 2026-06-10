# Commit Conventions for commit-changes Skill

Generated on: 2026-06-10
Skill version: 1.0

## Conventional Commits Format

<type>(<scope>): <description>

[optional body]

[optional footer]

## Types

| Type       | Description                          | Emoji |
| ---------- | ------------------------------------ | ----- |
| `feat`     | New feature                          | ✨    |
| `fix`      | Bug fix                              | 🐛    |
| `refactor` | Code restructuring                   | ♻️    |
| `docs`     | Documentation                        | 📝    |
| `style`    | Formatting/styling                   | 💄    |
| `test`     | Tests                                | ✅    |
| `chore`    | Maintenance                          | 🔧    |
| `perf`     | Performance                          | ⚡    |
| `build`    | Build/CI                             | 🏗️    |
| `revert`   | Revert                               | ⏪    |

## Scope Presets (Auto-Inferred)

| Path Pattern                    | Scope        |
| ------------------------------- | ------------ |
| `src/modules/<name>/*`          | `<name>`     |
| `src/features/<name>/*`         | `<name>`     |
| `src/components/<name>/*`       | `<name>`/`ui`|
| `src/hooks/*`                   | `hooks`      |
| `src/lib/*`                     | `lib`        |
| `src/api/*`                     | `api`        |
| `src/routes/*`                  | `routes`     |
| `src/repositories/*`            | `repos`      |
| `tests/<name>/*`                | `<name>`     |
| `*.md`, `docs/*`                | `docs`       |
| `package.json`, `pnpm-lock.yaml`| `deps`       |
| `.github/workflows/*`           | `ci`         |
| `wrangler.jsonc`, `turbo.json`  | `config`     |

## Description Rules

- Imperative mood: "add", "fix", "update"
- No period at end
- Max 72 chars subject
- Body explains WHY, not HOW

## Examples

```
feat(auth): implement JWT token refresh
fix(api): handle 401 in user service
refactor(ui): extract button base component
docs: update API auth examples
test(auth): add JWT refresh tests
chore(deps): upgrade typescript to 5.4
perf(db): add composite index for users
```
